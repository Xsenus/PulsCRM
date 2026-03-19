using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Загрузка и выдача файлов, используемых в рассылках.
/// </summary>
[ApiController]
[Authorize]
[Route("api/files")]
public sealed class FilesController(IFileStorageService fileStorageService) : ControllerBase
{
    /// <summary>
    /// Загружает файл в хранилище и возвращает его метаданные.
    /// </summary>
    /// <remarks>
    /// Запрос должен быть отправлен в формате <c>multipart/form-data</c> с полями <c>file</c> и опционально <c>isPublic</c>.
    /// </remarks>
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(StoredFileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StoredFileDto>> Upload([FromForm] FileUploadRequest request, CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
        {
            throw new ValidationException("Ожидается multipart/form-data.");
        }

        if (request.File is null)
        {
            throw new ValidationException("Файл не передан.");
        }

        await using var stream = request.File.OpenReadStream();
        var dto = await fileStorageService.SaveAsync(new FileUploadCommand
        {
            Content = stream,
            FileName = request.File.FileName,
            ContentType = request.File.ContentType,
            IsPublic = request.IsPublic
        }, cancellationToken);

        return Ok(dto);
    }

    /// <summary>
    /// Возвращает метаданные файла без скачивания содержимого.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(StoredFileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StoredFileDto>> GetById([FromRoute] int id, CancellationToken cancellationToken)
    {
        var dto = await fileStorageService.GetAsync(id, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// Скачивает содержимое файла по идентификатору.
    /// </summary>
    [HttpGet("{id:int}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download([FromRoute] int id, CancellationToken cancellationToken)
    {
        var opened = await fileStorageService.OpenReadAsync(id, cancellationToken);
        if (opened is null)
        {
            return NotFound();
        }

        return File(
            opened.Value.Content,
            opened.Value.Metadata.ContentType ?? "application/octet-stream",
            opened.Value.Metadata.OriginalFileName,
            enableRangeProcessing: true);
    }
}
