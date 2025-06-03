const asyncHandler = require('express-async-handler');
const Building = require('../models/building.model');
const buildPrompt = require('../services/groq.service'); 

exports.ask = asyncHandler(async (req, res) => {
   try {
      const { kioskID } = req.params;
      const { question } = req.body;

      // Get buildings via Mongoose
      const buildings = await Building.find();

      // Format data into a prompt
      const prompt = await buildPrompt(buildings, kioskID);
      const fullPrompt = `${prompt}\n\nUser asks: ${question}`;

      // Send request to Groq
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
         method: 'POST',
         headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
               { role: 'system', content: 'You are a helpful assistant using campus data to answer questions.' },
               { role: 'user', content: fullPrompt }
            ]
         })
      });

      const result = await response.json();

      const answer = result.choices?.[0]?.message?.content || 'Sorry, no response generated.';
      res.json({ answer });
   } 
   catch (error) {
      console.error('Groq ask error:', error);
      res.status(500).json({ error: 'Something went wrong. Please try again later.' });
   }
});
