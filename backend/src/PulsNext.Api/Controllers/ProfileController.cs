using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// «Мой профиль» — для любого вошедшего сотрудника: свои телефоны, фото, пароль и статус.
/// </summary>
[ApiController]
[Authorize]
[Route("api/profile")]
public sealed class ProfileController(IProfileService profileService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(MyProfileDto), StatusCodes.Status200OK)]
    public ActionResult<MyProfileDto> Get() => Ok(profileService.Get());

    [HttpPut("contacts")]
    [ProducesResponseType(typeof(MyProfileDto), StatusCodes.Status200OK)]
    public ActionResult<MyProfileDto> UpdateContacts([FromBody] ProfileContactsRequest request) => Ok(profileService.UpdateContacts(request));

    [HttpPut("photo")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    [ProducesResponseType(typeof(MyProfileDto), StatusCodes.Status200OK)]
    public ActionResult<MyProfileDto> UpdatePhoto([FromBody] ProfilePhotoRequest request) => Ok(profileService.UpdatePhoto(request));

    [HttpDelete("photo")]
    [ProducesResponseType(typeof(MyProfileDto), StatusCodes.Status200OK)]
    public ActionResult<MyProfileDto> DeletePhoto() => Ok(profileService.DeletePhoto());

    [HttpPost("password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult ChangePassword([FromBody] ProfilePasswordRequest request)
    {
        profileService.ChangePassword(request);
        return NoContent();
    }

    [HttpPut("status")]
    [ProducesResponseType(typeof(UserStatusDto), StatusCodes.Status200OK)]
    public ActionResult<UserStatusDto> SetStatus([FromBody] UserStatusRequest request) => Ok(profileService.SetStatus(request));

    [HttpDelete("status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult ClearStatus()
    {
        profileService.ClearStatus();
        return NoContent();
    }
}
