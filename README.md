# WebChat

WebChat la ung dung chat realtime xay dung bang ASP.NET Core Razor Pages, SignalR, ASP.NET Core Identity va Entity Framework Core voi PostgreSQL.

## Cong nghe su dung

- ASP.NET Core Razor Pages (`net10.0`)
- SignalR cho realtime messaging
- ASP.NET Core Identity cho dang nhap/dang ky
- Entity Framework Core
- PostgreSQL

## Cau truc chinh

- `Pages/`: cac trang nghiep vu chinh cua ung dung, hien tai chu yeu la man hinh chat
- `Areas/Identity/Pages/`: cac trang dang nhap, dang ky, quan ly tai khoan
- `Hubs/`: SignalR hub cho chat realtime
- `Data/`: `ApplicationDbContext`
- `Models/`: entity nhu `Chat`, `ChatUser`, `Message`, `ApplicationUser`
- `Controllers/FilesController.cs`: upload va phuc vu file media
- `Infrastructure/`: cac class phu tro runtime
- `wwwroot/`: CSS, JavaScript, thu muc upload va static assets

## Tinh nang hien tai

- Dang ky, dang nhap bang Identity
- Tao chat rieng theo email
- Tao nhom chat
- Gui tin nhan text, emoji
- Gui file, anh, video
- Hien thi unread theo `LastReadAt`
- Theo doi trang thai online/offline theo ket noi SignalR
- Cap nhat ten hien thi realtime sau khi sua profile

## Yeu cau

- .NET SDK 10
- PostgreSQL

## Cau hinh

Project doc connection string `DefaultConnection`.

File production/default:

`appsettings.json`

File development mau:

`appsettings.Development.json`

Vi du:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=PRN222_lab3_dev;Username=postgres;Password=your_password_here"
  }
}
```

Ban hay thay `your_password_here` bang mat khau PostgreSQL tren may cua ban.

## Cach chay project

1. Khoi tao database PostgreSQL.
2. Cap nhat connection string trong `appsettings.json` hoac `appsettings.Development.json`.
3. Chay migration:

```bash
dotnet ef database update
```

4. Chay ung dung:

```bash
dotnet run
```

5. Mo trinh duyet theo URL ma ASP.NET Core in ra trong terminal.

## Ghi chu ve thu muc Pages va Areas

- `Pages/` dung cho cac trang chinh cua ung dung nhu `/Chat`
- `Areas/Identity/Pages/` dung cho module xac thuc nhu `/Identity/Account/Login`

Day la cach to chuc dung va pho bien trong ASP.NET Core Razor Pages khi dung Identity.

## Media upload

- File duoc upload qua `FilesController`
- Gioi han cau hinh hien tai la `3GB`
- File duoc luu trong `wwwroot/uploads`

## Mot so file quan trong

- `Program.cs`: cau hinh DI, EF Core, Identity, SignalR va middleware
- `Hubs/ChatHub.cs`: xu ly tham gia phong, gui tin nhan, cap nhat da doc
- `Pages/Chat.cshtml` va `Pages/Chat.cshtml.cs`: UI chat va logic load/create chat
- `wwwroot/js/chat.js`: logic client-side cho SignalR, upload va render message

## Lenh huu ich

```bash
dotnet restore
dotnet build
dotnet ef database update
dotnet run
```
