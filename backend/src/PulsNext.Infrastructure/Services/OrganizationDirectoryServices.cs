using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

/// <summary>
/// Организация в справочнике для всех сотрудников: только то, что нужно, чтобы найти и связаться.
/// </summary>
public sealed class OrganizationDirectoryItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public string? Raion { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
}

public sealed class OrganizationDirectoryEmailDto
{
    public string Label { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public sealed class OrganizationDirectoryContactDto
{
    public string? Fio { get; set; }
    public string? Position { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
}

/// <summary>
/// Карточка справочника: реквизиты, адреса, телефоны, e-mail, руководитель и контактные лица.
/// Без долгов, банковских реквизитов, комментариев, лицензий и прочих служебных данных — они только в полной
/// карточке у администраторов.
/// </summary>
public sealed class OrganizationDirectoryCardDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public string? Kpp { get; set; }
    public string? Ogrn { get; set; }
    public string? Raion { get; set; }
    public string? OrgType { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
    public string? Phone { get; set; }
    public string? Site { get; set; }
    public IReadOnlyCollection<OrganizationDirectoryEmailDto> Emails { get; set; } = Array.Empty<OrganizationDirectoryEmailDto>();
    public string? DirectorName { get; set; }
    public string? DirectorPosition { get; set; }
    public string? DirectorPhone { get; set; }
    public IReadOnlyCollection<OrganizationDirectoryContactDto> Contacts { get; set; } = Array.Empty<OrganizationDirectoryContactDto>();
}

public interface IOrganizationDirectoryService
{
    PagedResult<OrganizationDirectoryItemDto> Search(string? search, int skip, int take);
    OrganizationDirectoryCardDto? GetCard(int id);
}

public sealed class OrganizationDirectoryService(LegacyUnitOfWork legacyUnitOfWork) : IOrganizationDirectoryService
{
    public const int MaxTake = 100;

    public PagedResult<OrganizationDirectoryItemDto> Search(string? search, int skip, int take)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        IQueryable<LegacyOrg> query = new XPQuery<LegacyOrg>(legacyUnitOfWork);
        if (term is not null)
        {
            // Поиск и страница — в SQL: справочник открывают все, а организаций тысячи.
            query = query.Where(x =>
                (x.Name != null && x.Name.Contains(term))
                || (x.SmallName != null && x.SmallName.Contains(term))
                || (x.FullName != null && x.FullName.Contains(term))
                || (x.INN != null && x.INN.Contains(term))
                || (x.Raion != null && x.Raion.Name != null && x.Raion.Name.Contains(term)));
        }

        var totalCount = query.Count();
        var page = query
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Oid)
            .Skip(Math.Max(0, skip))
            .Take(take <= 0 ? 25 : Math.Min(take, MaxTake))
            .ToList();
        legacyUnitOfWork.PreFetch(page, nameof(LegacyOrg.OrgInfo), nameof(LegacyOrg.Raion));

        var items = page.Select(org => new OrganizationDirectoryItemDto
        {
            Id = org.Oid,
            Name = org.Name ?? string.Empty,
            FullName = TextHelper.NullIfWhiteSpace(org.FullName) ?? TextHelper.NullIfWhiteSpace(org.SmallName),
            Inn = TextHelper.NullIfWhiteSpace(org.INN),
            Raion = TextHelper.NullIfWhiteSpace(org.Raion?.Name),
            Phone = TextHelper.NullIfWhiteSpace(org.OrgInfo?.Phone),
            Email = TextHelper.NullIfWhiteSpace(org.OrgInfo?.Email)
        }).ToArray();

        return new PagedResult<OrganizationDirectoryItemDto>(items, totalCount);
    }

    public OrganizationDirectoryCardDto? GetCard(int id)
    {
        var org = id > 0 ? legacyUnitOfWork.GetObjectByKey<LegacyOrg>(id) : null;
        if (org is null)
        {
            return null;
        }

        var info = org.OrgInfo;
        var other = org.OrgInfoOther;
        var emails = new[]
            {
                ("Основной", info?.Email),
                ("Руководитель", other?.RukEmail),
                ("Зарплата", other?.ZpEmail),
                ("1С", other?.F1cEmail),
                ("Сайт", other?.SiteEmail)
            }
            .Select(x => (x.Item1, Email: TextHelper.NullIfWhiteSpace(x.Item2)))
            .Where(x => x.Email is not null)
            .Select(x => new OrganizationDirectoryEmailDto { Label = x.Item1, Email = x.Email! })
            .ToArray();

        return new OrganizationDirectoryCardDto
        {
            Id = org.Oid,
            Name = org.Name ?? string.Empty,
            FullName = TextHelper.NullIfWhiteSpace(org.FullName) ?? TextHelper.NullIfWhiteSpace(org.SmallName),
            Inn = TextHelper.NullIfWhiteSpace(org.INN),
            Kpp = TextHelper.NullIfWhiteSpace(info?.KPP),
            Ogrn = TextHelper.NullIfWhiteSpace(other?.OGRN),
            Raion = TextHelper.NullIfWhiteSpace(org.Raion?.Name),
            OrgType = TextHelper.NullIfWhiteSpace(org.OrgType?.Name),
            AddressLegal = TextHelper.NullIfWhiteSpace(info?.AddressU),
            AddressActual = TextHelper.NullIfWhiteSpace(info?.AddressF),
            Phone = TextHelper.NullIfWhiteSpace(info?.Phone),
            Site = TextHelper.NullIfWhiteSpace(info?.Site),
            Emails = emails,
            DirectorName = TextHelper.NullIfWhiteSpace(other?.RukFIO),
            DirectorPosition = TextHelper.NullIfWhiteSpace(other?.RukDolgnost),
            DirectorPhone = TextHelper.NullIfWhiteSpace(other?.RukPhone),
            Contacts = org.Contacts
                .Where(x => !string.IsNullOrWhiteSpace(x.FIO) || !string.IsNullOrWhiteSpace(x.Phone) || !string.IsNullOrWhiteSpace(x.Email))
                .OrderBy(x => x.FIO, StringComparer.CurrentCultureIgnoreCase)
                .Select(x => new OrganizationDirectoryContactDto
                {
                    Fio = TextHelper.NullIfWhiteSpace(x.FIO),
                    Position = TextHelper.NullIfWhiteSpace(x.EnDolgnost?.Name ?? x.EnDolgnost?.FullName),
                    Phone = TextHelper.NullIfWhiteSpace(x.Phone),
                    Email = TextHelper.NullIfWhiteSpace(x.Email)
                })
                .ToArray()
        };
    }
}
