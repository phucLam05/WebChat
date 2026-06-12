using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace WebChat.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;
        private const long MaxUploadSize = 3L * 1024L * 1024L * 1024L;

        public FilesController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpGet("/uploads/{*fileName}")]
        public IActionResult GetUpload(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                return BadRequest();

            var safeFileName = Path.GetFileName(fileName);
            if (!string.Equals(safeFileName, fileName, StringComparison.Ordinal))
                return BadRequest();

            var uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads");
            var filePath = Path.Combine(uploadsFolder, safeFileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound();

            var contentTypeProvider = new FileExtensionContentTypeProvider();
            if (!contentTypeProvider.TryGetContentType(safeFileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            Response.Headers.Pragma = "no-cache";
            Response.Headers.Expires = "0";

            return PhysicalFile(filePath, contentType, enableRangeProcessing: true);
        }

        [HttpPost("upload")]
        [RequestSizeLimit(MaxUploadSize)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadSize)]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            var fileUrl = $"/uploads/{uniqueFileName}";

            return Ok(new
            {
                fileUrl,
                fileName = file.FileName,
                fileSize = file.Length,
                contentType = file.ContentType
            });
        }
    }
}
