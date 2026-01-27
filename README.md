📦 Backend_ChatBox – Real-Time Chat Backend (Node.js + Express + MongoDB + Socket.io)

A complete real-time chat backend similar to WhatsApp or Messenger, supporting real-time messaging, file uploads, push notifications, authentication, chat list, unread count, blocking, pinning, and more.

🚀 Features
🔐 Authentication

Signup & Login (JWT)

Password hashing (bcrypt)

Token validation middleware

Session check endpoint

Logout

👤 User Profile

Update profile picture

View current user info

🚫 User Controls

Block / Unblock users

Pin / Unpin chats

Get pinned and blocked user lists

💬 Messaging

Send text messages

Send images & files

Message statuses: sent, delivered, read

Message search

Secure message storage

Cannot message blocked users

Cannot message yourself

🧵 Chat List

Last message preview

Last message timestamp

Unread message count

Sorted by latest message

⚡ Real-Time (Socket.io)

Online users tracking

Typing indicators

Real-time message delivery

Real-time read receipts

JWT-secured socket connections

📣 Push Notifications (FCM)

Register device token

Remove device token

Push notifications when user is offline

📁 File Uploads

Supports:

JPG, PNG

PDF, DOC, DOCX

XLS, XLSX

TXT, CSV

ZIP

25MB max file size

🗄 Database

MongoDB models:

User

Message
With timestamps and indexing.

📁 Folder Structure
src/
 ├── controllers/
 ├── middleware/
 ├── models/
 ├── routes/
 ├── lib/
 ├── uploads/
 ├── server.js

▶ How to Run
1. Install dependencies
npm install

2. Create .env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/chat_app
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173

3. Start server
npm start

🛠 API Endpoints (Summary)
Auth

POST /api/auth/signup

POST /api/auth/login

POST /api/auth/logout

GET /api/auth/check

PUT /api/auth/update-profile

Messages

GET /api/messages/contacts

GET /api/messages/chats

GET /api/messages/:id

POST /api/messages/send/:id

PUT /api/messages/read/:messageId

GET /api/messages/search/:userId?q=...

Users

POST /api/users/block/:id

POST /api/users/unblock/:id

GET /api/users/blocked

POST /api/users/pin/:id

POST /api/users/unpin/:id

GET /api/users/pinned

Push Notifications

POST /api/push/register-fcm

POST /api/push/unregister-fcm

Remove device token.

🗺 4. ER Diagram (ASCII + Mermaid)
ASCII Version
+----------+          +------------+
|  User    | 1 ---- n |  Message   |
+----------+          +------------+
| _id      |          | _id        |
| fullName |          | text       |
| email    |          | image      |
| password |          | file       |
| blocked  |          | senderId   ---> User._id
| pinned   |          | receiverId ---> User._id
+----------+          +------------+

🏛 5. Backend Architecture Diagram

                    ┌──────────────────────────┐
                    │        Client App         │
                    │  (React / RN / Flutter)   │
                    └─────────────┬────────────┘
                                  │ HTTP & WebSocket
                    ┌─────────────▼────────────┐
                    │     Express Server        │
                    └─────────────┬────────────┘
             ┌────────────────────┼────────────────────┐
             │                    │                    │
   ┌─────────▼───────┐   ┌───────▼────────┐   ┌────────▼────────┐
   │ Auth Controller  │   │ Message Ctrl   │   │ User Controller │
   └─────────┬────────┘   └────────┬──────┘   └────────┬────────┘
             │                     │                    │
      ┌──────▼───────┐      ┌─────▼───────┐      ┌─────▼───────┐
      │ Auth Routes   │      │ Msg Routes  │      │ User Routes │
      └──────┬────────┘      └────┬────────┘      └────┬────────┘
             │                     │                    │
        ┌────▼────┐          ┌────▼──────┐       ┌─────▼─────┐
        │ Middleware│ (JWT, Upload, Block) │       │  Multer   │
        └────┬─────┘          └────┬──────┘       └─────┬─────┘
             │                     │                    │
       ┌─────▼────────┐      ┌────▼─────────┐    ┌─────▼────────┐
       │   Models      │      │   Socket.io   │    │ Firebase FCM │
       │ (User/Message)│      │ Events Engine │    │ Push System  │
       └───────────────┘      └──────────────┘    └──────────────┘

                        ┌────────────────────────────┐
                        │         MongoDB            │
                        └────────────────────────────┘
