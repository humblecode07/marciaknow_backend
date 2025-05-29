module.exports = function buildPrompt(buildings, kioskID) {
   let prompt = `Here is a list of buildings on our campus with their descriptions:\n\n`;

   buildings.forEach(building => {
      prompt += `Name: ${building.name}\n`;

      if (building.description)
         prompt += `Description: ${building.description}\n`;

      if (building.coordinates)
         prompt += `General Coordinates: ${JSON.stringify(building.coordinates)}\n`;

      const nearbyRooms = building.existingRoom?.get(kioskID);
      if (nearbyRooms && Array.isArray(nearbyRooms) && nearbyRooms.length > 0) {
         prompt += `Nearby Rooms:\n`;
         nearbyRooms.forEach(room => {
            prompt += ` - Room Name: ${room.name || 'Unknown'}\n`;
            if (room.description) prompt += `   Description: ${room.description}\n`;
            
            // Add navigation guide for each room if it exists
            if (room.navigationGuide && Array.isArray(room.navigationGuide) && room.navigationGuide.length > 0) {
               const onlyDescriptions = room.navigationGuide.map(step => step.description).join(' -> ');
               prompt += `   Navigation Guide: ${onlyDescriptions}\n`;
            }
         });
         // console.log(nearbyRooms);
      }

      // Building-level navigation guide (this part was correct)
      if (building.navigationGuide && building.navigationGuide.get(kioskID)) {
         const guide = building.navigationGuide.get(kioskID);
         const onlyDescriptions = guide.map(step => step.description).join(' -> ');
         prompt += `Navigation Guide: ${onlyDescriptions}\n`;
      }

      prompt += '\n';
   });

   prompt += `Use this information to help users find buildings or answer their questions.`;

   console.log(prompt);

   return prompt;
};