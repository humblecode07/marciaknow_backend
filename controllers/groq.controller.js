const asyncHandler = require('express-async-handler');
const Building = require('../models/building.model');
const buildPrompt = require('../services/groq.service');

exports.ask = asyncHandler(async (req, res) => {
   try {
      const { kioskID } = req.params;
      const { question } = req.body;

      // Fetch all buildings from DB
      const buildings = await Building.find();

      // Build the prompt with instructions to output JSON with detected_location, navigationGuide, and navigationPath
      const basePrompt = await buildPrompt(buildings, kioskID);
      const fullPrompt = `${basePrompt}\n\nUser asks: ${question}\n\n` +
         `Please respond ONLY in the following JSON format:\n` +
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
         `      "direction": "[north/south/east/west/straight/left/right]",\n` +
         `      "distance": "[estimated distance if available]",\n` +
         `      "landmark": "[notable landmark or reference point]"\n` +
         `    }\n` +
         `  ]\n` +
         `}\n\n` +
         `IMPORTANT RULES:\n` +
         `1. If user asks about directions, navigation, or "where is", set action to "navigate" and provide both navigationGuide and navigationPath\n` +
         `2. If user asks general questions about a location, set action to "info" and set navigation fields to null\n` +
         `3. If user mentions a location but asks something else, set action to "search" and set navigation fields to null\n` +
         `4. Match location names EXACTLY as they appear in the database\n` +
         `5. Set confidence based on how certain you are about the location match\n` +
         `6. For navigation requests, provide detailed step-by-step directions in navigationGuide and structured path in navigationPath\n` +
         `7. navigationPath should be an array of step objects with step number, instruction, direction, distance, and landmark\n` +
         `8. For ambiguous queries, ask for clarification and set all values to null`;

      // Call Groq API
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
                  content: 'You are a helpful campus navigation assistant. Always respond in the exact JSON format requested. Be precise with location names and actions. When providing navigation, give detailed step-by-step directions.'
               },
               { role: 'user', content: fullPrompt }
            ]
         })
      });

      const result = await response.json();
      const rawAnswer = result.choices?.[0]?.message?.content || '{}';

      // Try to parse the JSON string from AI
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

         // Validate and sanitize the response
         if (parsed.detected_location) {
            // Ensure detected_location has all required fields
            parsed.detected_location = {
               name: parsed.detected_location.name || null,
               type: parsed.detected_location.type || null,
               confidence: parsed.detected_location.confidence || null,
               action: parsed.detected_location.action || null
            };
         }

         // Ensure navigation fields exist
         parsed.navigationGuide = parsed.navigationGuide || null;
         parsed.navigationPath = parsed.navigationPath || null;

         // Validate navigationPath structure if it exists
         if (parsed.navigationPath && Array.isArray(parsed.navigationPath)) {
            parsed.navigationPath = parsed.navigationPath.map(step => ({
               step: step.step || null,
               instruction: step.instruction || null,
               direction: step.direction || null,
               distance: step.distance || null,
               landmark: step.landmark || null
            }));
         }

      } catch (e) {
         console.warn('Failed to parse AI JSON response, falling back to raw answer.');
         parsed.answer = rawAnswer; // fallback plain text
      }

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