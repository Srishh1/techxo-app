const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email, preferences } = req.body;
    
    // Check if already subscribed
    let subscriber = await Newsletter.findOne({ email });
    if (subscriber) {
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Create new subscription
    subscriber = new Newsletter({
      email,
      preferences,
      verificationToken
    });
    await subscriber.save();
    
    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your TechXO Newsletter subscription',
      html: `
        <h1>Welcome to TechXO Newsletter!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
      `
    });
    
    res.status(201).json({ message: 'Please check your email to verify your subscription' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify email subscription
router.get('/verify/:token', async (req, res) => {
  try {
    const subscriber = await Newsletter.findOne({ verificationToken: req.params.token });
    if (!subscriber) {
      return res.status(404).json({ error: 'Invalid verification token' });
    }
    
    subscriber.isVerified = true;
    subscriber.verificationToken = undefined;
    await subscriber.save();
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update subscription preferences
router.patch('/preferences', async (req, res) => {
  try {
    const { email, preferences } = req.body;
    
    const subscriber = await Newsletter.findOne({ email });
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    subscriber.preferences = preferences;
    await subscriber.save();
    
    res.json(subscriber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unsubscribe from newsletter
router.delete('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    const result = await Newsletter.findOneAndDelete({ email });
    if (!result) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({ message: 'Successfully unsubscribed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 