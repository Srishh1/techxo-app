const express = require('express');
const router = express.Router();
const News = require('../models/News');
const auth = require('../middleware/auth');

// Get all news articles with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const search = req.query.search;
    
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await News.countDocuments(query);
    const news = await News.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'username');
    
    res.json({
      news,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get single news article
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author', 'username')
      .populate('comments.user', 'username');
    
    if (!news) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    res.json(news);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new news article
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, category, tags, imageUrl } = req.body;
    
    const news = new News({
      title,
      content,
      category,
      tags,
      imageUrl,
      author: req.user._id
    });
    
    await news.save();
    await news.populate('author', 'username');
    
    res.status(201).json(news);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update news article
router.patch('/:id', auth, async (req, res) => {
  try {
    const news = await News.findOne({ _id: req.params.id, author: req.user._id });
    if (!news) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    const updates = Object.keys(req.body);
    const allowedUpdates = ['title', 'content', 'category', 'tags', 'imageUrl'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates' });
    }
    
    updates.forEach(update => news[update] = req.body[update]);
    await news.save();
    await news.populate('author', 'username');
    
    res.json(news);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete news article
router.delete('/:id', auth, async (req, res) => {
  try {
    const news = await News.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!news) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    res.json({ message: 'News article deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add comment to news article
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    news.comments.push({
      user: req.user._id,
      content: req.body.content
    });
    
    await news.save();
    await news.populate('comments.user', 'username');
    
    res.status(201).json(news.comments[news.comments.length - 1]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Like/unlike news article
router.post('/:id/like', auth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    const likeIndex = news.likes.indexOf(req.user._id);
    if (likeIndex === -1) {
      news.likes.push(req.user._id);
    } else {
      news.likes.splice(likeIndex, 1);
    }
    
    await news.save();
    res.json({ likes: news.likes.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 