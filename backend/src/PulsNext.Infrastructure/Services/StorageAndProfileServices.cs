using System.ComponentModel.DataAnnotations;
using DevExpress.Xpo;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Hosting;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public interface IFileStorageService
{
    Task<StoredFileDto> SaveAsync(FileUploadCommand command, CancellationToken cancellationToken);
    Task<StoredFileDto?> GetAsync(int id, CancellationToken cancellationToken);
    Task<(StoredFileDto Metadata, Stream Content)?> OpenReadAsync(int id, CancellationToken cancellationToken);
    string GetAbsolutePath(MailStoredFile file);
}

public sealed class FileStorageService(
    MailingUnitOfWork mailingUnitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IHostEnvironment hostEnvironment,
    Microsoft.Extensions.Options.IOptions<StorageOptions> storageOptions) : IFileStorageService
{
    public async Task<StoredFileDto> SaveAsync(FileUploadCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(command.FileName), "Имя файла не задано.");

        await using var memory = new MemoryStream();
        await command.Content.CopyToAsync(memory, cancellationToken);
        var bytes = memory.ToArray();

        ValidationHelper.Guard(bytes.LongLength > 0, "Файл пустой.");
        ValidationHelper.Guard(bytes.LongLength <= Math.Max(1, storageOptions.Value.MaxFileSizeBytes), $"Файл превышает лимит {storageOptions.Value.MaxFileSizeBytes} байт.");

        var now = DateTime.UtcNow;
        var extension = Path.GetExtension(command.FileName);
        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var relativeDirectory = Path.Combine(now.ToString("yyyy"), now.ToString("MM"), now.ToString("dd"));
        var relativePath = Path.Combine(relativeDirectory, storedFileName).Replace('\\', '/');
        var absolutePath = Path.Combine(GetUploadsRoot(), relativeDirectory, storedFileName);

        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
        await File.WriteAllBytesAsync(absolutePath, bytes, cancellationToken);

        var entity = new MailStoredFile(mailingUnitOfWork)
        {
            OriginalFileName = command.FileName,
            StoredFileName = storedFileName,
            RelativePath = relativePath,
            ContentType = TextHelper.NullIfWhiteSpace(command.ContentType) ?? "application/octet-stream",
            Length = bytes.LongLength,
            Sha256 = HashHelper.ComputeSha256(bytes),
            IsPublic = command.IsPublic,
            UploadedByLegacyUserId = currentUserAccessor.GetLegacyUserId() ?? 0,
            UploadedAtUtc = now
        };

        mailingUnitOfWork.CommitChanges();
        return MappingHelper.ToStoredFileDto(entity);
    }

    public Task<StoredFileDto?> GetAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailStoredFile>(id);
        return Task.FromResult(entity is null ? null : MappingHelper.ToStoredFileDto(entity));
    }

    public Task<(StoredFileDto Metadata, Stream Content)?> OpenReadAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailStoredFile>(id);
        if (entity is null)
        {
            return Task.FromResult<(StoredFileDto Metadata, Stream Content)?>(null);
        }

        var path = GetAbsolutePath(entity);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Файл {path} не найден.", path);
        }

        Stream stream = File.OpenRead(path);
        return Task.FromResult<(StoredFileDto Metadata, Stream Content)?>(new ValueTuple<StoredFileDto, Stream>(MappingHelper.ToStoredFileDto(entity), stream));
    }

    public string GetAbsolutePath(MailStoredFile file)
    {
        return Path.Combine(GetUploadsRoot(), (file.RelativePath ?? string.Empty).Replace('/', Path.DirectorySeparatorChar));
    }

    private string GetUploadsRoot()
    {
        var rootPath = storageOptions.Value.RootPath;
        var uploadsPath = storageOptions.Value.UploadsPath;
        var absolute = Path.GetFullPath(Path.Combine(hostEnvironment.ContentRootPath, rootPath, uploadsPath));
        Directory.CreateDirectory(absolute);
        return absolute;
    }
}

public interface ITransportProfileService
{
    Task<IReadOnlyCollection<TransportProfileDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<TransportProfileDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<TransportProfileDto> UpsertAsync(int? id, TransportProfileUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
    Task<TransportProfileTestResultDto> TestAsync(int id, CancellationToken cancellationToken);
    Task<MailTransportProfile?> GetPreferredProfileAsync(int? requestedProfileId, CancellationToken cancellationToken);
}

public sealed class TransportProfileService(
    MailingUnitOfWork mailingUnitOfWork,
    ISecretProtector secretProtector) : ITransportProfileService
{
    public Task<IReadOnlyCollection<TransportProfileDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var items = new XPQuery<MailTransportProfile>(mailingUnitOfWork)
            .ToList()
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name ?? string.Empty)
            .Select(MappingHelper.ToTransportProfileDto)
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<TransportProfileDto>>(items);
    }

    public Task<TransportProfileDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(id);
        return Task.FromResult(entity is null ? null : MappingHelper.ToTransportProfileDto(entity));
    }

    public Task<TransportProfileDto> UpsertAsync(int? id, TransportProfileUpsertRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Name), "Введите название SMTP-профиля.");
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Host), "Введите SMTP-хост.");
        ValidationHelper.Guard(request.Port > 0, "Введите корректный SMTP-порт.");
        ValidationHelper.Guard(EmailHelper.IsValid(request.SenderEmail), "Введите корректный email отправителя.");

        var now = DateTime.UtcNow;
        var entity = id is > 0
            ? mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(id.Value) ?? throw new KeyNotFoundException($"SMTP-профиль #{id} не найден.")
            : new MailTransportProfile(mailingUnitOfWork)
            {
                CreatedAtUtc = now,
                IsEnabled = true,
                MaxConnections = 2,
                MessagesPerMinute = 60,
                Port = 587,
                UseSsl = true
            };

        entity.Name = request.Name.Trim();
        entity.Host = request.Host.Trim();
        entity.Port = request.Port;
        entity.UseSsl = request.UseSsl;
        entity.Username = TextHelper.NullIfWhiteSpace(request.Username);
        entity.SenderEmail = TextHelper.NullIfWhiteSpace(request.SenderEmail);
        entity.SenderName = TextHelper.NullIfWhiteSpace(request.SenderName);
        entity.ReplyToEmail = TextHelper.NullIfWhiteSpace(request.ReplyToEmail);
        entity.MaxConnections = Math.Max(1, request.MaxConnections);
        entity.MessagesPerMinute = Math.Max(0, request.MessagesPerMinute);
        entity.IsEnabled = request.IsEnabled;
        entity.IsDefault = request.IsDefault;
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            entity.PasswordProtected = secretProtector.Protect(request.Password);
        }

        if (entity.IsDefault)
        {
            foreach (var profile in new XPQuery<MailTransportProfile>(mailingUnitOfWork).ToList().Where(x => x.Oid != entity.Oid))
            {
                profile.IsDefault = false;
            }
        }

        mailingUnitOfWork.CommitChanges();
        return Task.FromResult(MappingHelper.ToTransportProfileDto(entity));
    }

    public Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(id)
            ?? throw new KeyNotFoundException($"SMTP-профиль #{id} не найден.");

        var usedByCampaign = new XPQuery<MailCampaign>(mailingUnitOfWork).ToList().Any(x => x.TransportProfile?.Oid == id);
        if (usedByCampaign)
        {
            throw new ValidationException("Нельзя удалить SMTP-профиль, который используется в кампаниях.");
        }

        entity.Delete();
        mailingUnitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    public async Task<TransportProfileTestResultDto> TestAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(id)
            ?? throw new KeyNotFoundException($"SMTP-профиль #{id} не найден.");

        try
        {
            using var client = new SmtpClient();
            client.Timeout = 30000;
            await client.ConnectAsync(entity.Host, entity.Port, entity.UseSsl, cancellationToken);

            if (!string.IsNullOrWhiteSpace(entity.Username))
            {
                var password = secretProtector.Unprotect(entity.PasswordProtected);
                await client.AuthenticateAsync(entity.Username, password, cancellationToken);
            }

            await client.DisconnectAsync(true, cancellationToken);

            return new TransportProfileTestResultDto
            {
                Success = true,
                Message = "Подключение к SMTP прошло успешно."
            };
        }
        catch (Exception ex)
        {
            return new TransportProfileTestResultDto
            {
                Success = false,
                Message = ex.Message
            };
        }
    }

    public Task<MailTransportProfile?> GetPreferredProfileAsync(int? requestedProfileId, CancellationToken cancellationToken)
    {
        MailTransportProfile? profile = null;
        if (requestedProfileId is > 0)
        {
            profile = mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(requestedProfileId.Value);
        }

        profile ??= new XPQuery<MailTransportProfile>(mailingUnitOfWork)
            .ToList()
            .Where(x => x.IsEnabled)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name ?? string.Empty)
            .FirstOrDefault();

        return Task.FromResult(profile);
    }
}
