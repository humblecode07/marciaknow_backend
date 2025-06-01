const DestinationLog = require('../models/destinationLog.model');
const Building = require('../models/building.model');
// Note: Room is embedded in Building, so we don't need a separate Room model import

const logDestinationSearch = async (req, res) => {
   try {
      const { buildingId, roomId, searchQuery, destinationType, kioskId } = req.body;

      const destinationLog = new DestinationLog({
         buildingId,
         roomId,
         searchQuery,
         destinationType,
         kioskId,
         sessionId: req.sessionID || null,
      });

      await destinationLog.save();

      res.status(201).json({
         success: true,
         message: 'Destination search logged successfully',
         logId: destinationLog._id,
      });

   } catch (error) {
      console.error('Error logging destination search:', error);
      res.status(500).json({
         success: false,
         message: 'Failed to log destination search',
         error: error.message,
      });
   }
};

const getMostFrequentDestinations = async (req, res) => {
   try {
      const { timeframe = 'month' } = req.query;

      // Calculate date range based on timeframe
      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
         case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
         default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Aggregate frequent destinations
      const frequentDestinations = await DestinationLog.aggregate([
         {
            $match: {
               timestamp: { $gte: startDate }
            }
         },
         {
            $group: {
               _id: {
                  buildingId: '$buildingId',
                  roomId: '$roomId',
                  destinationType: '$destinationType'
               },
               count: { $sum: 1 },
               lastAccessed: { $max: '$timestamp' },
               searchQueries: { $addToSet: '$searchQuery' }
            }
         },
         {
            $sort: { count: -1 }
         },
         {
            $limit: 20
         }
      ]);

      // Populate with building/room details based on your schema structure
      const populatedResults = await Promise.all(
         frequentDestinations.map(async (dest) => {
            let buildingName = 'Unknown Building';
            let roomName = null;

            try {
               // Find building by the auto-incremented 'id' field, not '_id'
               const building = await Building.findOne({ id: dest._id.buildingId });

               if (building) {
                  buildingName = building.name;

                  // If there's a roomId, find the room within the building's existingRoom Map
                  if (dest._id.roomId) {
                     // Search through all floors in existingRoom Map
                     for (const [floor, rooms] of building.existingRoom) {
                        const room = rooms.find(r => r._id.toString() === dest._id.roomId);
                        if (room) {
                           roomName = room.name;
                           break;
                        }
                     }
                  }
               }
            } catch (error) {
               console.error('Error populating destination details:', error);
            }

            return {
               buildingId: dest._id.buildingId,
               roomId: dest._id.roomId,
               destinationType: dest._id.destinationType,
               buildingName,
               roomName,
               count: dest.count,
               lastAccessed: dest.lastAccessed,
               searchQueries: dest.searchQueries,
            };
         })
      );

      res.json({
         success: true,
         timeframe,
         period: {
            startDate: startDate.toISOString(),
            endDate: now.toISOString()
         },
         destinations: populatedResults,
         totalLogs: await DestinationLog.countDocuments({
            timestamp: { $gte: startDate }
         })
      });

   } catch (error) {
      console.error('Error fetching frequent destinations:', error);
      res.status(500).json({
         success: false,
         message: 'Failed to fetch frequent destinations',
         error: error.message,
      });
   }
};

module.exports = {
   logDestinationSearch,
   getMostFrequentDestinations,
};