const asyncHandler = require('express-async-handler');
const Building = require('../models/building.model');
const buildPrompt = require('../services/groq.service');

exports.ask = asyncHandler(async (req, res) => {
   try {
      const { kioskID } = req.params;
      const { question } = req.body;

      // Fetch all buildings from DB
      const buildings = await Building.find();

      // Build base prompt with location data and kiosk ID
      const basePrompt = await buildPrompt(buildings, kioskID);
      const fullPrompt = `${basePrompt}\n\nUser asks: ${question}\n\n` +
         `You must respond with a SINGLE JSON object only, with NO surrounding text, no explanations, no notes, no markdown.\n\n` +
         `Respond strictly in this JSON format:\n` +
         `{\n` +
         `  "answer": "[Your natural language response here]",\n` +
         `  "detected_location": {\n` +
         `    "name": "[Exact building/room name if detected, otherwise null]",\n` +
         `    "type": "[building/room/null]",\n` +
         `    "confidence": "[high/medium/low]",\n` +
         `    "action": "[navigate/search/info/null]"\n` +
         `  },\n` +
         `  "navigationGuide": "[Step-by-step text directions if navigation requested, otherwise null]",\n` +
         `  "navigationPath": [\n` +
         `    {\n` +
         `      "step": 1,\n` +
         `      "instruction": "[Brief instruction]",\n` +
         `      "direction": "[north/south/east/west/straight/left/right/up/down]",\n` +
         `      "distance": "[estimated distance if available]",\n` +
         `      "landmark": "[notable landmark or reference point]"\n` +
         `    }\n` +
         `  ]\n` +
         `}\n\n` +
         `IMPORTANT RULES:\n` +
         `1. Respond ONLY with valid JSON. No intro, no explanation.\n` +
         `2. If unsure of location, set all values to null and action to null.\n` +
         `3. Match exact building/room names. Be concise and correct.\n` +
         `4. Don't make up places. Don't hallucinate responses.\n`;

      // GROQ API request
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
         method: 'POST',
         headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
               {
                  role: 'system',
                  content: 'You are a JSON-only campus assistant. You must NEVER include natural language outside the JSON block. Never say “Here is the response”. Only return a single JSON object per request.'
               },
               { role: 'user', content: fullPrompt }
            ]
         })
      });

      const result = await response.json();
      let rawAnswer = result.choices?.[0]?.message?.content || '{}';

      // Strip surrounding junk if it returns explanation
      const jsonMatch = rawAnswer.match(/{[\s\S]+}/);
      if (jsonMatch) rawAnswer = jsonMatch[0];

      let parsed = {
         answer: "Sorry, no response generated.",
         detected_location: {
            name: null,
            type: null,
            confidence: null,
            action: null
         },
         navigationGuide: null,
         navigationPath: null
      };

      try {
         parsed = JSON.parse(rawAnswer);

         // Clean up detected_location
         parsed.detected_location = {
            name: parsed.detected_location?.name || null,
            type: parsed.detected_location?.type || null,
            confidence: parsed.detected_location?.confidence || null,
            action: parsed.detected_location?.action || null
         };

         parsed.navigationGuide = parsed.navigationGuide || null;

         if (Array.isArray(parsed.navigationPath)) {
            parsed.navigationPath = parsed.navigationPath.map((step, i) => ({
               step: step.step ?? i + 1,
               instruction: step.instruction || null,
               direction: step.direction || null,
               distance: step.distance || null,
               landmark: step.landmark || null
            }));
         } else {
            parsed.navigationPath = null;
         }

      } catch (e) {
         console.warn('Failed to parse AI JSON response:', e);
         parsed.answer = rawAnswer;
      }

      // Add this after you get the response from Groq
      console.log('Raw AI response:', rawAnswer);
      console.log('Parsed response:', parsed);
      console.log('Final response being sent:', {
         answer: parsed.answer,
         detected_location: parsed.detected_location,
         navigationGuide: parsed.navigationGuide,
         navigationPath: parsed.navigationPath
      });

      res.json({
         answer: parsed.answer,
         detected_location: parsed.detected_location,
         navigationGuide: parsed.navigationGuide,
         navigationPath: parsed.navigationPath
      });

   } catch (error) {
      console.error('Groq ask error:', error);
      res.status(500).json({
         error: 'Something went wrong. Please try again later.',
         detected_location: {
            name: null,
            type: null,
            confidence: null,
            action: null
         },
         navigationGuide: null,
         navigationPath: null
      });
   }
});
