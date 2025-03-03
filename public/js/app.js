// Initialize Socket.io connection with auth token
let socket;

const initializeSocket = async () => {
    return new Promise((resolve) => {
        if (socket) {
            socket.disconnect();
        }
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token for socket initialization');
            resolve();
            return;
        }

        socket = io({
            auth: {
                token: token
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('Socket connected');
            resolve();
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            if (error.message === 'Authentication error') {
                handleLogout();
            }
            resolve();
        });
    });
};

// Initialize socket when the page loads
initializeSocket();

// DOM Elements
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
const mainContent = document.getElementById('main-content');
const newsletterForm = document.getElementById('newsletter-form');
const authButtons = document.getElementById('auth-buttons');

// State management
let currentUser = null;
let currentRoom = null;

// Simple mobile menu toggle without debouncing
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
}

// Check authentication status
const checkAuth = async () => {
    console.log('Checking authentication...');
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
        console.log('No token or user data found');
        currentUser = null;
        updateAuthUI();
        return false;
    }

    try {
        currentUser = JSON.parse(storedUser);
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('User authenticated:', currentUser);
            updateAuthUI();
            await initializeSocket();
            return true;
        } else {
            console.log('Auth check failed, logging out');
            handleLogout();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        handleLogout();
        return false;
    }
};

// Update UI based on authentication status
const updateAuthUI = () => {
    if (!authButtons) return;

    if (currentUser) {
        authButtons.innerHTML = `
            <span class="text-gray-300 mr-4">Welcome, ${currentUser.username}</span>
            <button 
                onclick="handleLogout()" 
                class="text-gray-300 hover:text-lavender-200 cursor-pointer px-3 py-1 rounded">
                Logout
            </button>
        `;
    } else {
        authButtons.innerHTML = `
            <a href="/login" class="text-gray-300 hover:text-lavender-200 px-3 py-1 rounded">Login</a>
            <a href="/register" class="ml-4 px-4 py-2 bg-lavender-600 text-white rounded-md hover:bg-lavender-700">Register</a>
        `;
    }
};

// Newsletter subscription
newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    
    try {
        const response = await fetch('/api/newsletter/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('Thank you for subscribing! Please check your email to confirm your subscription.');
            newsletterForm.reset();
        } else {
            alert(data.error || 'Subscription failed. Please try again.');
        }
    } catch (error) {
        console.error('Newsletter subscription failed:', error);
        alert('Subscription failed. Please try again.');
    }
});

// News feed functions
const loadNews = async (page = 1, techCategory = 'all') => {
    try {
        // Show loading state
        mainContent.innerHTML = `
            <div class="flex justify-center items-center min-h-[400px]">
                <div class="spinner"></div>
            </div>
        `;

        const apiKey = '15cc3bd639c346228d6432ffc49620ef';
        const pageSize = 10;
        
        // Base URL always filters for technology category
        let apiUrl = `https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=${pageSize}&page=${page}&apiKey=${apiKey}`;
        
        // Add specific tech keywords if a subcategory is selected
        if (techCategory !== 'all') {
            apiUrl = `https://newsapi.org/v2/everything?q=${techCategory}+technology&sortBy=publishedAt&pageSize=${pageSize}&page=${page}&apiKey=${apiKey}`;
        }
        
        // Fetch external news
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (apiData.status === 'error') {
            throw new Error(apiData.message || 'Failed to load news');
        }

        // Fetch user-submitted posts
        let userPosts = [];
        try {
            const userPostsResponse = await fetch(`/api/news?category=${techCategory !== 'all' ? techCategory : ''}`);
            if (userPostsResponse.ok) {
                const userPostsData = await userPostsResponse.json();
                userPosts = userPostsData.news || [];
            }
        } catch (error) {
            console.error('Failed to load user posts:', error);
        }

        // Filter API articles to ensure they're tech-related
        const techKeywords = ['tech', 'technology', 'software', 'hardware', 'digital', 'ai', 'artificial intelligence', 
                             'app', 'computer', 'internet', 'cyber', 'data', 'programming', 'code', 'developer', 
                             'startup', 'innovation', 'gadget', 'mobile', 'web', 'cloud', 'robot', 'automation'];
        
        // Only apply additional keyword filtering for 'all' category to avoid over-filtering
        let filteredApiArticles = apiData.articles || [];
        if (techCategory === 'all') {
            filteredApiArticles = filteredApiArticles.filter(article => {
                const title = article.title?.toLowerCase() || '';
                const description = article.description?.toLowerCase() || '';
                return techKeywords.some(keyword => 
                    title.includes(keyword) || description.includes(keyword)
                );
            });
        }
        
        // If filtering removed all articles, use original set
        if (filteredApiArticles.length === 0) {
            filteredApiArticles = apiData.articles || [];
        }

        // Convert user posts to the same format as API articles
        const formattedUserPosts = userPosts.map(post => ({
            title: post.title,
            description: post.content.substring(0, 200) + '...',
            url: `/news/${post._id}`,
            urlToImage: post.imageUrl,
            author: post.author?.username || 'Unknown Author',
            publishedAt: post.createdAt,
            source: { name: 'User Submitted' },
            isUserPost: true,
            hasVideo: post.videoUrl ? true : false,
            id: post._id
        }));

        // Combine and sort all articles by date (newest first)
        const allArticles = [...formattedUserPosts, ...filteredApiArticles].sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
        );

        if (allArticles.length === 0) {
            mainContent.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-gray-600 mb-4">No technology news articles found</p>
                    <button onclick="loadNews(1, 'all')" class="px-4 py-2 bg-black text-white rounded hover:bg-gray-900">
                        Refresh
                    </button>
                </div>
            `;
            return;
        }
        
        displayNews({
            articles: allArticles,
            currentPage: page,
            totalPages: Math.ceil(apiData.totalResults / pageSize),
            totalResults: apiData.totalResults,
            currentCategory: techCategory
        });
    } catch (error) {
        console.error('Failed to load news:', error);
        mainContent.innerHTML = `
            <div class="text-center py-8">
                <p class="text-red-600 mb-4">Failed to load technology news: ${error.message}</p>
                <button onclick="loadNews(1, 'all')" class="px-4 py-2 bg-black text-white rounded hover:bg-gray-900">
                    Try Again
                </button>
            </div>
        `;
    }
};

const displayNews = (data) => {
    const newsHtml = data.articles.map(article => `
        <article class="bg-white rounded-lg shadow-md p-6 mb-6 hover:shadow-xl transition-shadow duration-300">
            <div class="relative">
                ${article.urlToImage ? 
                    `<img src="${article.urlToImage}" alt="${article.title}" class="w-full h-48 object-cover mb-4 rounded" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGYyZjUiLz48cGF0aCBkPSJNMzAwLDE4MCBMNTAwLDE4MCBMNTAwLDIyMCBMMzAwLDIyMCBaIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48Y2lyY2xlIGN4PSI0MDAiIGN5PSIxNDAiIHI9IjQwIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48cGF0aCBkPSJNMzAwLDI2MCBMNTAwLDI2MCBMNDAwLDMwMCBaIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48dGV4dCB4PSI0MDAiIHk9IjM0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UZWNoWE8gTmV3czwvdGV4dD48L3N2Zz4='; this.classList.add('bg-gray-100');">` : 
                    `<div class="w-full h-48 bg-gradient-to-br from-gray-100 to-lavender-50 mb-4 rounded flex items-center justify-center">
                        <div class="text-center p-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-lavender-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div class="flex items-center justify-center">
                                <span class="text-lavender-600 font-medium">TechXO</span>
                                <span class="mx-2 text-gray-400">|</span>
                                <span class="text-gray-500">No Image Available</span>
                            </div>
                        </div>
                    </div>`
                }
                <div class="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                    ${article.isUserPost ? 'User Post' : 'Tech News'}
                </div>
                ${article.hasVideo ? 
                    `<div class="absolute bottom-6 right-2 bg-lavender-600 text-white text-xs px-2 py-1 rounded flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                        </svg>
                        Video
                    </div>` : ''
                }
            </div>
            <h2 class="text-2xl font-bold mb-3 text-gray-900 hover:text-lavender-600 transition-colors duration-300">
                <a href="${article.url}" ${!article.isUserPost ? 'target="_blank" rel="noopener noreferrer"' : ''}>${article.title}</a>
            </h2>
            <p class="text-gray-600 mb-4">${article.description || ''}</p>
            <div class="flex items-center justify-between text-sm text-gray-500">
                <span>By ${article.author || 'Unknown Author'}</span>
                <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
            </div>
            <div class="mt-4 flex justify-end">
                <a href="${article.url}" ${!article.isUserPost ? 'target="_blank" rel="noopener noreferrer"' : ''} 
                   class="px-4 py-2 bg-lavender-600 text-white rounded hover:bg-lavender-700 transition-colors duration-300">
                    Read More
                </a>
            </div>
        </article>
    `).join('');

    // Create category filter buttons
    const techCategories = [
        { id: 'all', name: 'All Tech' },
        { id: 'ai', name: 'AI & ML' },
        { id: 'software', name: 'Software' },
        { id: 'hardware', name: 'Hardware' },
        { id: 'cybersecurity', name: 'Cybersecurity' },
        { id: 'startup', name: 'Startups' },
        { id: 'mobile', name: 'Mobile' }
    ];
    
    const categoryButtons = techCategories.map(category => 
        `<button 
            onclick="loadNews(1, '${category.id}')" 
            class="px-4 py-2 rounded-full ${data.currentCategory === category.id ? 
                'bg-lavender-600 text-white' : 
                'bg-gray-200 text-gray-800 hover:bg-lavender-100 hover:text-lavender-800'} transition-colors duration-300"
        >
            ${category.name}
        </button>`
    ).join('');

    mainContent.innerHTML = `
        <div class="mb-8">
            <h1 class="text-4xl font-bold text-center mb-2">Latest Technology News</h1>
            <p class="text-gray-600 text-center mb-6">Stay updated with the latest technology news and insights</p>
            
            <div class="flex flex-wrap justify-center gap-2 mb-4">
                ${categoryButtons}
            </div>
            
            <div class="text-center mt-4 mb-8">
                <a href="/post" class="inline-flex items-center px-6 py-3 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Share Your Tech News
                </a>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${newsHtml}
        </div>
        <div class="mt-8 flex justify-center space-x-4">
            ${data.currentPage > 1 ? 
                `<button onclick="loadNews(${data.currentPage - 1}, '${data.currentCategory}')" class="px-6 py-2 bg-lavender-600 text-white rounded hover:bg-lavender-700 transition-colors duration-300">
                    Previous
                </button>` : ''
            }
            ${data.currentPage < data.totalPages ? 
                `<button onclick="loadNews(${data.currentPage + 1}, '${data.currentCategory}')" class="px-6 py-2 bg-lavender-600 text-white rounded hover:bg-lavender-700 transition-colors duration-300">
                    Next
                </button>` : ''
            }
        </div>
    `;
};

// Chat room functions
const initializeChat = () => {
    // Initialize socket if user is logged in
    if (currentUser && localStorage.getItem('token')) {
        // Ensure socket is connected
        if (!socket || !socket.connected) {
            initializeSocket();
        }
    }

    mainContent.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-gray-50 to-lavender-50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div class="flex gap-6 h-[700px]">
                    <!-- Users List -->
                    <div class="w-1/4 bg-gray-50 rounded-xl p-4 shadow-inner border border-gray-100">
                        <h3 class="text-lg font-semibold text-gray-900 mb-4">Online Users</h3>
                        <div id="users-list" class="space-y-2">
                            <!-- Users will be added here -->
                        </div>
                    </div>
                    
                    <!-- Chat Area -->
                    <div class="flex-1 flex flex-col bg-gray-50 rounded-xl p-4 shadow-inner border border-gray-100">
                        <div id="chat-messages" class="flex-1 overflow-y-auto mb-4 space-y-4">
                            <div class="text-center text-gray-500">
                                Welcome to the chat room!
                            </div>
                            ${!currentUser ? `
                            <div class="bg-lavender-50 text-lavender-800 p-4 rounded-lg mb-4 text-center">
                                <p class="mb-2">You are viewing the chat as a guest.</p>
                                <p>To participate in the conversation, please <a href="/login" class="text-lavender-600 hover:underline">login</a> or <a href="/register" class="text-lavender-600 hover:underline">register</a>.</p>
                            </div>
                            ` : ''}
                        </div>
                        <form id="chat-form" class="flex gap-4">
                            <input 
                                type="text" 
                                id="message-input" 
                                class="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all"
                                placeholder="${currentUser ? 'Type your message...' : 'Login to send messages'}"
                                ${!currentUser ? 'disabled' : ''}
                            >
                            <button 
                                type="submit" 
                                class="px-6 py-3 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg"
                                ${!currentUser ? 'disabled' : ''}
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const usersList = document.getElementById('users-list');

    // Only set up socket events if user is logged in
    if (currentUser && socket) {
        // Handle users list update
        socket.on('users list', (users) => {
            onlineUsers.clear();
            users.forEach(username => onlineUsers.add(username));
            updateUsersList();
        });

        // Handle incoming messages
        socket.on('chat message', (data) => {
            addChatMessage(data, chatMessages);
        });

        // Handle user joined/left events
        socket.on('user joined', (username) => {
            onlineUsers.add(username);
            updateUsersList();
            addSystemMessage(`${username} joined the chat`);
        });

        socket.on('user left', (username) => {
            onlineUsers.delete(username);
            updateUsersList();
            addSystemMessage(`${username} left the chat`);
        });

        // Handle message submission
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (message) {
                socket.emit('chat message', {
                    message,
                    username: currentUser.username
                });
                messageInput.value = '';
            }
        });

        // Keep track of online users
        const onlineUsers = new Set();
        onlineUsers.add(currentUser.username);

        // Update users list in the UI
        function updateUsersList() {
            usersList.innerHTML = Array.from(onlineUsers)
                .map(username => `
                    <div class="flex items-center gap-2 p-2 ${username === currentUser.username ? 'bg-lavender-50' : ''}">
                        <div class="w-2 h-2 rounded-full bg-green-500"></div>
                        <span class="${username === currentUser.username ? 'font-bold' : ''}">${username}</span>
                    </div>
                `)
                .join('');
        }

        // Add system message
        function addSystemMessage(message) {
            addSystemMessage(message, chatMessages);
        }

        // Initialize the chat room
        updateUsersList();
        socket.emit('join chat', currentUser.username);
    } else {
        // Display a message for non-logged in users
        usersList.innerHTML = `
            <div class="text-gray-500 text-center p-4">
                <p>Login to see online users</p>
            </div>
        `;
    }
};

// Authentication functions
const handleLogin = async (email, password) => {
    try {
        console.log('Attempting login with email:', email);
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);
        const data = await response.json();
        console.log('Login response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        if (!data.token || !data.user) {
            throw new Error('Invalid server response: missing token or user data');
        }

        // Store user data and token
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        console.log('User data stored:', currentUser);

        // Initialize socket
        await initializeSocket();
        console.log('Socket initialized');

        // Update UI
        updateAuthUI();
        console.log('UI updated');

        // Redirect to chat
        console.log('Redirecting to chat...');
        window.location.href = '/chat';
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

const handleRegister = async (username, email, password) => {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateAuthUI();
            window.location.href = '/chat';
        } else {
            throw new Error(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration failed:', error);
        alert(error.message);
    }
};

const handleLogout = () => {
    console.log('Logging out...');
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateAuthUI();
    window.location.replace('/login');
};

// Route handling
const handleRoute = async () => {
    const path = window.location.pathname;
    const isAuthenticated = await checkAuth();
    console.log('Handling route:', path, 'Is authenticated:', isAuthenticated);
    
    // Ensure mainContent exists
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }
    
    switch (path) {
        case '/':
            displayHomepage();
            break;
        case '/news':
            loadNews(1, 'all');
            break;
        case '/post':
            console.log('Displaying post form');
            displayPostForm();
            break;
        case '/chat':
            console.log('Initializing chat');
            initializeChat();
            break;
        case '/login':
            if (isAuthenticated) {
                console.log('Already authenticated, redirecting to chat');
                window.location.replace('/chat');
            } else {
                console.log('Displaying login form');
                displayLoginForm();
            }
            break;
        case '/register':
            if (isAuthenticated) {
                window.location.replace('/chat');
            } else {
                displayRegisterForm();
            }
            break;
        default:
            if (path.startsWith('/news/')) {
                const category = path.split('/')[2];
                loadNews(1, category || 'all');
            } else {
                mainContent.innerHTML = '<p class="text-center">Page not found</p>';
            }
    }
};

// Display homepage with welcome section and tech industry information
const displayHomepage = () => {
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="min-h-screen">
            <!-- Hero Section -->
            <section class="relative overflow-hidden bg-gradient-to-br from-black to-gray-900 text-white py-20 mb-12 rounded-3xl shadow-2xl">
                <div class="absolute inset-0 opacity-20">
                    <div class="absolute inset-0 bg-[url('/img/circuit-pattern.svg')] bg-repeat opacity-10"></div>
                    <div class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black to-transparent"></div>
                </div>
                <div class="container mx-auto px-6 relative z-10">
                    <div class="flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 mb-10 md:mb-0">
                            <h1 class="text-5xl md:text-6xl font-bold mb-4 leading-tight">
                                <span class="text-lavender-400">Welcome to</span> TechXO
                            </h1>
                            <p class="text-xl md:text-2xl mb-8 text-gray-300">Your gateway to the future of technology</p>
                            <p class="text-gray-400 mb-8 text-lg">Stay ahead with the latest news, insights, and innovations from the tech industry. Join our community of tech enthusiasts and professionals.</p>
                            <div class="flex flex-wrap gap-4">
                                <a href="/news" class="px-8 py-3 bg-lavender-600 hover:bg-lavender-700 rounded-lg shadow-lg transition-all transform hover:scale-105 inline-flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd" />
                                        <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
                                    </svg>
                                    Explore News
                                </a>
                                <a href="/post" class="px-8 py-3 bg-transparent border border-lavender-400 hover:bg-lavender-900 rounded-lg shadow-lg transition-all transform hover:scale-105 inline-flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                                    </svg>
                                    Share Your Story
                                </a>
                            </div>
                        </div>
                        <div class="md:w-1/2 flex justify-center">
                            <div class="relative w-full max-w-lg">
                                <div class="absolute top-0 -left-4 w-72 h-72 bg-lavender-600 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                                <div class="absolute top-0 -right-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                                <div class="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
                                <div class="relative">
                                    <div class="bg-gradient-to-br from-gray-800 to-black p-8 rounded-2xl shadow-2xl transform rotate-2 hover:rotate-0 transition-all duration-300 h-80 flex items-center justify-center overflow-hidden">
                                        <div class="absolute inset-0 opacity-20">
                                            <svg class="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                                <defs>
                                                    <linearGradient id="circuitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stop-color="#9d8cd4" />
                                                        <stop offset="100%" stop-color="#5140a8" />
                                                    </linearGradient>
                                                </defs>
                                                <path d="M10,30 L30,30 L30,10 M70,10 L70,30 L90,30 M90,70 L70,70 L70,90 M30,90 L30,70 L10,70" stroke="url(#circuitGradient)" stroke-width="0.5" fill="none" />
                                                <circle cx="50" cy="50" r="20" stroke="url(#circuitGradient)" stroke-width="0.5" fill="none" />
                                                <path d="M25,50 L40,50 M60,50 L75,50 M50,25 L50,40 M50,60 L50,75" stroke="url(#circuitGradient)" stroke-width="0.5" fill="none" />
                                            </svg>
                                        </div>
                                        <div class="text-center z-10">
                                            <div class="w-24 h-24 mx-auto bg-gradient-to-br from-lavender-500 to-purple-700 rounded-full flex items-center justify-center mb-6 shadow-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <h3 class="text-lavender-200 text-2xl font-bold mb-2">TechXO</h3>
                                            <p class="text-gray-400 text-lg">Exploring the future of technology</p>
                                            <div class="mt-6 flex justify-center space-x-3">
                                                <span class="w-3 h-3 bg-lavender-500 rounded-full animate-pulse"></span>
                                                <span class="w-3 h-3 bg-purple-500 rounded-full animate-pulse animation-delay-500"></span>
                                                <span class="w-3 h-3 bg-pink-500 rounded-full animate-pulse animation-delay-1000"></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Tech Trends Section -->
            <section class="py-12 mb-12">
                <div class="container mx-auto px-6">
                    <h2 class="text-3xl font-bold text-center mb-12 relative">
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-lavender-600 to-purple-600">Latest Tech Trends</span>
                        <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-lavender-500 rounded-full"></div>
                    </h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-white rounded-xl shadow-lg p-6 transform transition-all hover:scale-105 hover:shadow-xl border-t-4 border-lavender-500">
                            <div class="w-14 h-14 bg-lavender-100 rounded-lg flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <h3 class="text-xl font-bold mb-2">Artificial Intelligence</h3>
                            <p class="text-gray-600 mb-4">AI continues to revolutionize industries with advancements in machine learning, natural language processing, and computer vision.</p>
                            <a href="/news/ai" class="text-lavender-600 hover:text-lavender-800 inline-flex items-center">
                                Learn more
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </a>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-lg p-6 transform transition-all hover:scale-105 hover:shadow-xl border-t-4 border-lavender-500">
                            <div class="w-14 h-14 bg-lavender-100 rounded-lg flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 class="text-xl font-bold mb-2">Cybersecurity</h3>
                            <p class="text-gray-600 mb-4">As digital threats evolve, cybersecurity measures become increasingly sophisticated to protect sensitive data and systems.</p>
                            <a href="/news/cybersecurity" class="text-lavender-600 hover:text-lavender-800 inline-flex items-center">
                                Learn more
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </a>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-lg p-6 transform transition-all hover:scale-105 hover:shadow-xl border-t-4 border-lavender-500">
                            <div class="w-14 h-14 bg-lavender-100 rounded-lg flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                </svg>
                            </div>
                            <h3 class="text-xl font-bold mb-2">Web 3.0</h3>
                            <p class="text-gray-600 mb-4">The next generation of the internet is emerging with blockchain technology, decentralized applications, and the metaverse.</p>
                            <a href="/news/web3" class="text-lavender-600 hover:text-lavender-800 inline-flex items-center">
                                Learn more
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Community Section -->
            <section class="py-12 bg-gradient-to-br from-gray-50 to-lavender-50 rounded-3xl mb-12">
                <div class="container mx-auto px-6">
                    <div class="flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 mb-8 md:mb-0">
                            <h2 class="text-3xl font-bold mb-6">Join Our Tech Community</h2>
                            <p class="text-gray-600 mb-6">Connect with like-minded tech enthusiasts, share your insights, and stay updated with the latest developments in the tech world.</p>
                            <div class="space-y-4">
                                <div class="flex items-center">
                                    <div class="w-10 h-10 rounded-full bg-lavender-100 flex items-center justify-center mr-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                        </svg>
                                    </div>
                                    <span>Engage in discussions with industry experts</span>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-10 h-10 rounded-full bg-lavender-100 flex items-center justify-center mr-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </div>
                                    <span>Share your tech stories and insights</span>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-10 h-10 rounded-full bg-lavender-100 flex items-center justify-center mr-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-lavender-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <span>Stay ahead with real-time tech updates</span>
                                </div>
                            </div>
                            <div class="mt-8">
                                <a href="/chat" class="px-6 py-3 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg inline-flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                                    </svg>
                                    Join the Conversation
                                </a>
                            </div>
                        </div>
                        <div class="md:w-1/2">
                            <div class="relative">
                                <div class="absolute -top-4 -left-4 w-24 h-24 bg-lavender-200 rounded-full z-0"></div>
                                <div class="absolute -bottom-4 -right-4 w-32 h-32 bg-lavender-300 rounded-full z-0"></div>
                                <div class="bg-gradient-to-br from-lavender-100 to-white p-8 rounded-xl shadow-xl relative z-10 h-80 flex items-center justify-center overflow-hidden">
                                    <div class="absolute inset-0 opacity-10">
                                        <svg class="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M10,10 L90,10 L90,90 L10,90 Z" stroke="#9d8cd4" stroke-width="0.5" fill="none" />
                                            <circle cx="50" cy="50" r="30" stroke="#9d8cd4" stroke-width="0.5" fill="none" />
                                            <path d="M20,50 H80 M50,20 V80" stroke="#9d8cd4" stroke-width="0.5" fill="none" />
                                        </svg>
                                    </div>
                                    <div class="text-center z-10">
                                        <div class="flex justify-center mb-8 relative">
                                            <div class="absolute w-full h-full bg-gradient-to-r from-lavender-200 to-lavender-400 rounded-full opacity-20 animate-pulse"></div>
                                            <div class="w-16 h-16 bg-gradient-to-br from-lavender-500 to-lavender-700 rounded-full flex items-center justify-center mx-2 shadow-lg transform -translate-y-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div class="w-16 h-16 bg-gradient-to-br from-lavender-600 to-purple-700 rounded-full flex items-center justify-center mx-2 shadow-lg z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                                </svg>
                                            </div>
                                            <div class="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center mx-2 shadow-lg transform translate-y-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 class="text-gray-800 text-2xl font-bold mb-2">Join our growing community</h3>
                                        <p class="text-gray-600">Connect with tech enthusiasts worldwide</p>
                                        <div class="mt-6 flex justify-center">
                                            <div class="px-4 py-2 bg-lavender-100 rounded-full text-lavender-700 text-sm font-medium">
                                                <span class="inline-block w-2 h-2 bg-lavender-500 rounded-full mr-2 animate-pulse"></span>
                                                Online now: 253 members
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Latest News Preview -->
            <section class="py-12 mb-12">
                <div class="container mx-auto px-6">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-3xl font-bold">Latest Tech News</h2>
                        <a href="/news" class="text-lavender-600 hover:text-lavender-800 inline-flex items-center">
                            View all news
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </a>
                    </div>
                    
                    <div id="news-preview" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div class="flex justify-center items-center col-span-full py-12">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Call to Action -->
            <section class="py-16 bg-black text-white rounded-3xl mb-12 relative overflow-hidden">
                <div class="absolute inset-0 opacity-30">
                    <div class="absolute inset-0 bg-gradient-to-br from-lavender-600 to-purple-900"></div>
                </div>
                <div class="container mx-auto px-6 relative z-10 text-center">
                    <h2 class="text-4xl font-bold mb-6">Ready to dive into the world of technology?</h2>
                    <p class="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">Join TechXO today and become part of a growing community of tech enthusiasts who are shaping the future.</p>
                    <div class="flex flex-wrap justify-center gap-4">
                        <a href="/register" class="px-8 py-4 bg-lavender-600 hover:bg-lavender-700 rounded-lg shadow-lg transition-all transform hover:scale-105">
                            Create an Account
                        </a>
                        <a href="/news" class="px-8 py-4 bg-transparent border border-white hover:bg-white hover:text-black rounded-lg shadow-lg transition-all transform hover:scale-105">
                            Browse News
                        </a>
                    </div>
                </div>
            </section>
        </div>
    `;

    // Load news preview for the homepage
    loadNewsPreview();
};

// Load a preview of the latest news for the homepage
const loadNewsPreview = async () => {
    const newsPreviewElement = document.getElementById('news-preview');
    if (!newsPreviewElement) return;

    try {
        // Fetch the latest news (limited to 3 items)
        const apiKey = '15cc3bd639c346228d6432ffc49620ef';
        const apiUrl = `https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=3&apiKey=${apiKey}`;
        
        // Fetch external news
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        // Fetch user-submitted posts (limited to 3)
        let userPosts = [];
        try {
            const userPostsResponse = await fetch('/api/news?limit=3');
            if (userPostsResponse.ok) {
                const userPostsData = await userPostsResponse.json();
                userPosts = userPostsData.news || [];
            }
        } catch (error) {
            console.error('Failed to load user posts for preview:', error);
        }

        // Format user posts to match API format
        const formattedUserPosts = userPosts.map(post => ({
            title: post.title,
            description: post.content.substring(0, 120) + '...',
            url: `/news/${post._id}`,
            urlToImage: post.imageUrl,
            author: post.author?.username || 'Unknown Author',
            publishedAt: post.createdAt,
            source: { name: 'User Submitted' },
            isUserPost: true
        }));

        // Combine and sort all articles by date (newest first)
        const allArticles = [...formattedUserPosts, ...apiData.articles].sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
        ).slice(0, 3); // Limit to 3 articles

        if (allArticles.length === 0) {
            newsPreviewElement.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-gray-600">No news articles available at the moment.</p>
                </div>
            `;
            return;
        }
        
        // Display the news preview
        newsPreviewElement.innerHTML = allArticles.map(article => `
            <article class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div class="relative h-48">
                    ${article.urlToImage ? 
                        `<img src="${article.urlToImage}" alt="${article.title}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGYyZjUiLz48cGF0aCBkPSJNMzAwLDE4MCBMNTAwLDE4MCBMNTAwLDIyMCBMMzAwLDIyMCBaIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48Y2lyY2xlIGN4PSI0MDAiIGN5PSIxNDAiIHI9IjQwIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48cGF0aCBkPSJNMzAwLDI2MCBMNTAwLDI2MCBMNDAwLDMwMCBaIiBmaWxsPSIjOWQ4Y2Q0IiBvcGFjaXR5PSIwLjgiLz48dGV4dCB4PSI0MDAiIHk9IjM0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UZWNoWE8gTmV3czwvdGV4dD48L3N2Zz4='; this.classList.add('bg-gray-100');">` : 
                        `<div class="w-full h-full bg-gradient-to-br from-gray-100 to-lavender-50 flex items-center justify-center">
                            <div class="text-center p-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-lavender-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div class="flex items-center justify-center">
                                    <span class="text-lavender-600 font-medium">TechXO</span>
                                    <span class="mx-2 text-gray-400">|</span>
                                    <span class="text-gray-500">No Image</span>
                                </div>
                            </div>
                        </div>`
                    }
                    <div class="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                        ${article.isUserPost ? 'User Post' : 'Tech News'}
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-3 text-gray-900 hover:text-lavender-600 transition-colors duration-300 line-clamp-2">
                        <a href="${article.url}" ${!article.isUserPost ? 'target="_blank" rel="noopener noreferrer"' : ''}>${article.title}</a>
                    </h3>
                    <p class="text-gray-600 mb-4 line-clamp-2">${article.description || ''}</p>
                    <div class="flex items-center justify-between text-sm text-gray-500">
                        <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.error('Failed to load news preview:', error);
        newsPreviewElement.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-red-600">Failed to load news preview: ${error.message}</p>
            </div>
        `;
    }
};

// Form display functions
const displayLoginForm = () => {
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-gray-50 to-lavender-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">Welcome Back</h2>
                <div id="login-error" class="hidden mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100"></div>
                <form id="login-form" class="space-y-6">
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="login-email">Email</label>
                        <input 
                            type="email" 
                            id="login-email" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Enter your email"
                        >
                    </div>
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="login-password">Password</label>
                        <input 
                            type="password" 
                            id="login-password" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Enter your password"
                        >
                    </div>
                    <button 
                        type="submit" 
                        id="login-button" 
                        class="w-full py-3 px-4 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    `;

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const loginButton = document.getElementById('login-button');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();  // Prevent event bubbling
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                loginError.textContent = 'Please enter both email and password';
                loginError.classList.remove('hidden');
                return;
            }
            
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
            loginError.classList.add('hidden');
            
            try {
                await handleLogin(email, password);
                // If we get here, login was successful
                console.log('Login successful, redirecting...');
            } catch (error) {
                console.error('Login form error:', error);
                loginError.textContent = error.message || 'Login failed. Please check your credentials and try again.';
                loginError.classList.remove('hidden');
                loginButton.disabled = false;
                loginButton.textContent = 'Sign In';
            }
        });
    }
};

const displayRegisterForm = () => {
    mainContent.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-gray-50 to-lavender-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">Create an Account</h2>
                <div id="register-error" class="hidden mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100"></div>
                <form id="register-form" class="space-y-6">
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="register-username">Username</label>
                        <input 
                            type="text" 
                            id="register-username" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Choose a username"
                        >
                    </div>
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="register-email">Email</label>
                        <input 
                            type="email" 
                            id="register-email" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Enter your email"
                        >
                    </div>
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="register-password">Password</label>
                        <input 
                            type="password" 
                            id="register-password" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Create a password"
                        >
                    </div>
                    <button 
                        type="submit" 
                        class="w-full py-3 px-4 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Register
                    </button>
                </form>
            </div>
        </div>
    `;

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        handleRegister(username, email, password);
    });
};

// Post creation form
const displayPostForm = () => {
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-gray-50 to-lavender-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">Create a Tech News Post</h2>
                
                ${!currentUser ? `
                <div class="mb-6 p-4 bg-lavender-50 text-lavender-800 rounded-lg border border-lavender-100 text-center">
                    <p class="mb-2">You need to be logged in to publish a post.</p>
                    <div class="mt-4 flex justify-center gap-4">
                        <a href="/login" class="px-6 py-2 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all">Login</a>
                        <a href="/register" class="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all">Register</a>
                    </div>
                </div>
                ` : ''}
                
                <div id="post-error" class="hidden mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100"></div>
                <div id="post-success" class="hidden mb-4 p-4 bg-green-50 text-green-600 rounded-lg border border-green-100"></div>
                
                <form id="post-form" class="space-y-6">
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-title">Title</label>
                        <input 
                            type="text" 
                            id="post-title" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Enter a catchy title"
                            ${!currentUser ? 'disabled' : ''}
                        >
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-category">Category</label>
                        <select 
                            id="post-category" 
                            required 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            ${!currentUser ? 'disabled' : ''}
                        >
                            <option value="">Select a category</option>
                            <option value="Technology">Technology</option>
                            <option value="AI">AI</option>
                            <option value="Cybersecurity">Cybersecurity</option>
                            <option value="Programming">Programming</option>
                            <option value="Startups">Startups</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-content">Content</label>
                        <textarea 
                            id="post-content" 
                            required 
                            rows="8"
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Write your news article here..."
                            ${!currentUser ? 'disabled' : ''}
                        ></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-tags">Tags (comma separated)</label>
                        <input 
                            type="text" 
                            id="post-tags" 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="e.g., tech, innovation, ai"
                            ${!currentUser ? 'disabled' : ''}
                        >
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-image">Image</label>
                        <div class="flex items-center space-x-4">
                            <input 
                                type="file" 
                                id="post-image" 
                                accept="image/*"
                                class="hidden"
                                ${!currentUser ? 'disabled' : ''}
                            >
                            <button 
                                type="button" 
                                id="image-upload-btn"
                                class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors duration-300"
                                ${!currentUser ? 'disabled' : ''}
                            >
                                Choose Image
                            </button>
                            <span id="image-name" class="text-sm text-gray-500">No image selected</span>
                        </div>
                        <div id="image-preview" class="mt-4 hidden">
                            <img id="preview-img" class="max-h-64 rounded border border-gray-200" src="" alt="Preview">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2 text-sm font-medium" for="post-video">Video (optional)</label>
                        <div class="flex items-center space-x-4">
                            <input 
                                type="file" 
                                id="post-video" 
                                accept="video/*"
                                class="hidden"
                                ${!currentUser ? 'disabled' : ''}
                            >
                            <button 
                                type="button" 
                                id="video-upload-btn"
                                class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors duration-300"
                                ${!currentUser ? 'disabled' : ''}
                            >
                                Choose Video
                            </button>
                            <span id="video-name" class="text-sm text-gray-500">No video selected</span>
                        </div>
                        <div id="video-preview" class="mt-4 hidden">
                            <video id="preview-video" class="max-h-64 rounded border border-gray-200" controls></video>
                        </div>
                    </div>
                    
                    <button 
                        type="submit" 
                        id="post-button" 
                        class="w-full py-3 px-4 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 transition-all shadow-md hover:shadow-lg"
                        ${!currentUser ? 'disabled' : ''}
                    >
                        Publish Post
                    </button>
                </form>
            </div>
        </div>
    `;

    // Only set up form functionality if user is logged in
    if (currentUser) {
        // Set up file upload buttons
        const imageUploadBtn = document.getElementById('image-upload-btn');
        const videoUploadBtn = document.getElementById('video-upload-btn');
        const imageInput = document.getElementById('post-image');
        const videoInput = document.getElementById('post-video');
        const imageName = document.getElementById('image-name');
        const videoName = document.getElementById('video-name');
        const imagePreview = document.getElementById('image-preview');
        const videoPreview = document.getElementById('video-preview');
        const previewImg = document.getElementById('preview-img');
        const previewVideo = document.getElementById('preview-video');
        
        // Image upload handling
        imageUploadBtn.addEventListener('click', () => {
            imageInput.click();
        });
        
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                imageName.textContent = file.name;
                
                // Preview image
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                imageName.textContent = 'No image selected';
                imagePreview.classList.add('hidden');
            }
        });
        
        // Video upload handling
        videoUploadBtn.addEventListener('click', () => {
            videoInput.click();
        });
        
        videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                videoName.textContent = file.name;
                
                // Preview video
                const url = URL.createObjectURL(file);
                previewVideo.src = url;
                videoPreview.classList.remove('hidden');
            } else {
                videoName.textContent = 'No video selected';
                videoPreview.classList.add('hidden');
            }
        });

        // Form submission
        const postForm = document.getElementById('post-form');
        const postError = document.getElementById('post-error');
        const postSuccess = document.getElementById('post-success');
        const postButton = document.getElementById('post-button');

        if (postForm) {
            postForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                postButton.disabled = true;
                postButton.textContent = 'Publishing...';
                postError.classList.add('hidden');
                postSuccess.classList.add('hidden');
                
                try {
                    const title = document.getElementById('post-title').value;
                    const category = document.getElementById('post-category').value;
                    const content = document.getElementById('post-content').value;
                    const tags = document.getElementById('post-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    
                    const formData = new FormData();
                    formData.append('title', title);
                    formData.append('category', category);
                    formData.append('content', content);
                    formData.append('tags', JSON.stringify(tags));
                    
                    if (imageInput.files[0]) {
                        formData.append('image', imageInput.files[0]);
                    }
                    
                    if (videoInput.files[0]) {
                        formData.append('video', videoInput.files[0]);
                    }
                    
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/news', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        postSuccess.textContent = 'Your post has been published successfully!';
                        postSuccess.classList.remove('hidden');
                        postForm.reset();
                        imagePreview.classList.add('hidden');
                        videoPreview.classList.add('hidden');
                        imageName.textContent = 'No image selected';
                        videoName.textContent = 'No video selected';
                        
                        // Redirect to the news page after a delay
                        setTimeout(() => {
                            window.location.href = '/news';
                        }, 2000);
                    } else {
                        throw new Error(data.error || 'Failed to publish post');
                    }
                } catch (error) {
                    console.error('Post creation error:', error);
                    postError.textContent = error.message;
                    postError.classList.remove('hidden');
                } finally {
                    postButton.disabled = false;
                    postButton.textContent = 'Publish Post';
                }
            });
        }
    }
};

// Load news detail for user-submitted posts
const loadNewsDetail = async (newsId) => {
    try {
        // Show loading state
        mainContent.innerHTML = `
            <div class="flex justify-center items-center min-h-[400px]">
                <div class="spinner"></div>
            </div>
        `;

        const response = await fetch(`/api/news/${newsId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const post = await response.json();
        
        // Format date
        const publishDate = new Date(post.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create tags HTML
        const tagsHtml = post.tags && post.tags.length > 0 
            ? `<div class="flex flex-wrap gap-2 mb-6">
                ${post.tags.map(tag => `
                    <span class="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full">${tag}</span>
                `).join('')}
               </div>`
            : '';

        // Create video HTML if available
        const videoHtml = post.videoUrl 
            ? `<div class="mb-8">
                <video class="w-full rounded-lg shadow-lg" controls>
                    <source src="${post.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
               </div>`
            : '';

        mainContent.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div class="mb-6">
                    <a href="/news" class="inline-flex items-center text-gray-600 hover:text-black transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                        </svg>
                        Back to News
                    </a>
                </div>
                
                <h1 class="text-4xl font-bold text-gray-900 mb-4">${post.title}</h1>
                
                <div class="flex items-center text-gray-500 mb-6">
                    <span class="mr-4">By ${post.author?.username || 'Unknown Author'}</span>
                    <span>${publishDate}</span>
                </div>
                
                ${tagsHtml}
                
                ${post.imageUrl ? `
                    <div class="mb-8">
                        <img src="${post.imageUrl}" alt="${post.title}" class="w-full rounded-lg shadow-lg">
                    </div>
                ` : ''}
                
                ${videoHtml}
                
                <div class="prose max-w-none">
                    ${post.content.split('\n').map(paragraph => 
                        paragraph ? `<p class="mb-4">${paragraph}</p>` : ''
                    ).join('')}
                </div>
                
                <div class="mt-12 pt-8 border-t border-gray-100">
                    <h3 class="text-xl font-bold mb-4">Comments</h3>
                    
                    ${post.comments && post.comments.length > 0 ? 
                        post.comments.map(comment => `
                            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-medium">${comment.user?.username || 'Anonymous'}</span>
                                    <span class="text-sm text-gray-500">${new Date(comment.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p>${comment.content}</p>
                            </div>
                        `).join('') : 
                        '<p class="text-gray-500">No comments yet. Be the first to comment!</p>'
                    }
                    
                    <form id="comment-form" class="mt-6">
                        <textarea 
                            id="comment-content" 
                            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-200 focus:border-lavender-400 transition-all bg-gray-50"
                            placeholder="Add a comment..."
                            rows="3"
                            required
                        ></textarea>
                        <button 
                            type="submit" 
                            class="mt-2 px-6 py-2 bg-lavender-600 text-white rounded hover:bg-lavender-700 transition-colors duration-300"
                        >
                            Post Comment
                        </button>
                    </form>
                </div>
            </div>
        `;

        // Handle comment submission
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            commentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('You must be logged in to comment');
                    window.location.href = '/login';
                    return;
                }
                
                const content = document.getElementById('comment-content').value;
                
                try {
                    const response = await fetch(`/api/news/${newsId}/comments`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ content })
                    });
                    
                    if (response.ok) {
                        // Reload the page to show the new comment
                        loadNewsDetail(newsId);
                    } else {
                        const data = await response.json();
                        throw new Error(data.error || 'Failed to post comment');
                    }
                } catch (error) {
                    console.error('Comment submission error:', error);
                    alert(error.message);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load news detail:', error);
        mainContent.innerHTML = `
            <div class="text-center py-8">
                <p class="text-red-600 mb-4">Failed to load article: ${error.message}</p>
                <a href="/news" class="px-4 py-2 bg-black text-white rounded hover:bg-gray-900 inline-block">
                    Back to News
                </a>
            </div>
        `;
    }
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    await checkAuth();
    await handleRoute();
});

// Remove problematic event listeners
const originalPushState = history.pushState;
history.pushState = function() {
    originalPushState.apply(this, arguments);
    handleRoute();
};

window.addEventListener('popstate', handleRoute);

// Add a more specific navigation handler
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link && !link.closest('form')) {  // Don't handle links inside forms
        const href = link.getAttribute('href');
        if (href.startsWith('/')) {  // Only handle internal navigation
            e.preventDefault();
            history.pushState({}, '', href);
            handleRoute();
        }
    }
});

// Update message display functions
function addChatMessage(data, chatMessages) {
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    const isOwnMessage = data.username === currentUser.username;
    
    messageElement.className = `mb-4 ${isOwnMessage ? 'ml-auto' : 'mr-auto'} max-w-[70%]`;
    messageElement.innerHTML = `
        <div class="${isOwnMessage ? 'bg-lavender-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3 shadow-sm">
            <div class="flex items-center gap-2 mb-1">
                <span class="font-bold ${isOwnMessage ? 'text-lavender-100' : 'text-lavender-600'}">${data.username}</span>
                <span class="text-xs ${isOwnMessage ? 'text-gray-200' : 'text-gray-500'}">${new Date().toLocaleTimeString()}</span>
            </div>
            <p class="break-words">${data.message}</p>
        </div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message, chatMessages) {
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    messageElement.className = 'text-center text-gray-400 my-2 italic';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 