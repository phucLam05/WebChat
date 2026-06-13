# WebChat

WebChat is a real-time chat application built with ASP.NET Core Razor Pages, SignalR, ASP.NET Core Identity, Entity Framework Core, and PostgreSQL.

## Tech Stack

- ASP.NET Core Razor Pages (`net10.0`)
- SignalR for real-time messaging
- ASP.NET Core Identity for authentication
- Entity Framework Core
- PostgreSQL

## Project Structure

- `Pages/`: main application pages, currently focused on the chat UI
- `Areas/Identity/Pages/`: login, register, and account management pages
- `Hubs/`: SignalR hub for real-time chat
- `Data/`: `ApplicationDbContext`
- `Models/`: entities such as `Chat`, `ChatUser`, `Message`, and `ApplicationUser`
- `Controllers/FilesController.cs`: file upload and media serving
- `Infrastructure/`: runtime helper classes
- `wwwroot/`: CSS, JavaScript, uploads, and static assets

## Current Features

- User registration and login with Identity
- Private chat creation by email
- Group chat creation
- Text and emoji messaging
- File, image, and video sharing
- Unread tracking based on `LastReadAt`
- Online/offline presence tracking through SignalR connections
- Real-time display name updates after profile changes

## Requirements

- .NET SDK 10
- PostgreSQL

## Configuration

The application reads the database connection string from `DefaultConnection`.

Default configuration file:

`appsettings.json`

Development configuration sample:

`appsettings.Development.json`

Example:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=PRN222_lab3_dev;Username=postgres;Password=your_password_here"
  }
}
```

Replace `your_password_here` with your local PostgreSQL password.

## How to Run

1. Create a PostgreSQL database.
2. Update the connection string in `appsettings.json` or `appsettings.Development.json`.
3. Apply the migrations:

```bash
dotnet ef database update
```

4. Run the application:

```bash
dotnet run
```

5. Open the URL printed by ASP.NET Core in the terminal.

## Why Both `Pages` and `Areas` Exist

- `Pages/` contains the main application pages such as `/Chat`
- `Areas/Identity/Pages/` contains the authentication module such as `/Identity/Account/Login`

This is a common and correct structure for ASP.NET Core Razor Pages projects that use Identity.

## Media upload

- Files are uploaded through `FilesController`
- The current configured upload limit is `3GB`
- Uploaded files are stored in `wwwroot/uploads`

## Important Files

- `Program.cs`: configures DI, EF Core, Identity, SignalR, and middleware
- `Hubs/ChatHub.cs`: handles room joining, message sending, and read status updates
- `Pages/Chat.cshtml` and `Pages/Chat.cshtml.cs`: chat UI and page logic
- `wwwroot/js/chat.js`: client-side SignalR, upload, and message rendering logic

## Useful Commands

```bash
dotnet restore
dotnet build
dotnet ef database update
dotnet run
```
