const express = require('express');
const router = express.Router();
const News = require('../models/News');
const auth = require('../middleware/auth');

// Get user posts
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const total = await News.countDocuments({ author: req.user._id });
    const posts = await News.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'username');
    
    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new post
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, category, tags, imageUrl } = req.body;
    
    const post = new News({
      title,
      content,
      category,
      tags,
      imageUrl,
      author: req.user._id
    });
    
    await post.save();
    await post.populate('author', 'username');
    
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update post
router.patch('/:id', auth, async (req, res) => {
  try {
    const post = await News.findOne({ _id: req.params.id, author: req.user._id });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const updates = Object.keys(req.body);
    const allowedUpdates = ['title', 'content', 'category', 'tags', 'imageUrl'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates' });
    }
    
    updates.forEach(update => post[update] = req.body[update]);
    await post.save();
    await post.populate('author', 'username');
    
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await News.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 