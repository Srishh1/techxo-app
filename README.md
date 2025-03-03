# Tech News Platform

A modern tech news aggregator and community platform with a sleek **Black & Lavender** design theme.

## Features

- **News Aggregation**: Latest technology news from various sources
- **User Posts**: Create and share your own tech news articles
- **Real-time Chat**: Discuss tech topics with other users
- **Responsive Design**: Elegant black and lavender UI that works on all devices
- **Authentication**: Secure user registration and login system
- **Categories**: Filter news by technology categories
- **Multimedia Support**: Share posts with images and videos

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/tech-news-platform.git
cd tech-news-platform
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NEWS_API_KEY=your_news_api_key
```

4. Start the development server
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Color Scheme

The platform features an elegant black and lavender color scheme:
- Primary background: Black
- Accent color: Lavender shades
- Text: White and light gray on dark backgrounds, dark gray on light backgrounds
- Highlights: Lavender gradients

## Technologies Used

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Real-time Communication**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **External APIs**: News API

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- News data provided by [News API](https://newsapi.org/)
- Icons from [Heroicons](https://heroicons.com/)

## API Endpoints

- POST /api/auth/register - Register new user
- POST /api/auth/login - User login
- POST /api/newsletter/subscribe - Subscribe to newsletter
- GET /api/news - Get latest news
- POST /api/news - Create new news post
- GET /api/posts - Get user posts
- POST /api/posts - Create new post

## Contributing

Feel free to submit issues and enhancement requests. 