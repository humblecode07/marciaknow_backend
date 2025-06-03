const QrScanLog = require('../models/qrScanLog.model')

const logQrScan = async (req, res) => {
  try {
    const { buildingId, kioskId } = req.params;
    const { buildingName } = req.body;

    if (!buildingId || !kioskId) {
      return res.status(400).json({
        success: false,
        message: 'Building ID and Kiosk ID are required'
      });
    }

    // Create scan log entry
    const scanLog = new QrScanLog({
      buildingId: buildingId,
      buildingName: buildingName || 'Unknown Building',
      kioskId: kioskId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer'),
      sessionId: req.sessionID
    });

    await scanLog.save();

    res.status(201).json({
      success: true,
      message: 'QR scan logged successfully',
      data: {
        scanId: scanLog._id,
        scannedAt: scanLog.scannedAt,
        buildingName: scanLog.buildingName,
        kioskId: scanLog.kioskId
      }
    });

  } catch (error) {
    console.error('QR Scan Logging Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log QR scan',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getDailyScanReport = async (req, res) => {
  try {
    const { startDate, endDate, kioskId, buildingId } = req.query;

    let end, start;
    
    if (endDate) {
      end = new Date(endDate);
    } else {
      end = new Date(); // Today
    }
    
    if (startDate) {
      start = new Date(startDate);
    } else {
      start = new Date();
      start.setDate(start.getDate() - 30); 
    }

    // IMPORTANT: Set time boundaries for database query
    const dbStart = new Date(start);
    const dbEnd = new Date(end);
    dbStart.setHours(0, 0, 0, 0);
    dbEnd.setHours(23, 59, 59, 999);

    const filters = {};
    if (kioskId) filters.kioskId = kioskId;
    if (buildingId) filters.buildingId = buildingId;

    console.log('Original dates:', { start: start.toISOString(), end: end.toISOString() });
    console.log('DB query dates:', { dbStart: dbStart.toISOString(), dbEnd: dbEnd.toISOString() });
    console.log('Filters:', filters);

    const dailyCounts = await QrScanLog.getDailyScanCounts(dbStart, dbEnd, filters);
    
    console.log('Daily counts from DB:', dailyCounts);

    // Create a map for faster lookup
    const countMap = new Map();
    dailyCounts.forEach(item => {
      countMap.set(item.reportDate, item.totalScans);
      console.log('Added to map:', item.reportDate, '->', item.totalScans);
    });

    const filledData = [];
    
    // Use separate date object for iteration to avoid mutation issues
    const iterDate = new Date(start);
    iterDate.setHours(0, 0, 0, 0); // Normalize time
    
    const endDate_normalized = new Date(end);
    endDate_normalized.setHours(0, 0, 0, 0); // Normalize time
    
    console.log('Iteration range:', { 
      iterStart: iterDate.toISOString(), 
      iterEnd: endDate_normalized.toISOString() 
    });
    
    // Generate all dates from start to end (inclusive)
    while (iterDate <= endDate_normalized) {
      const dateString = iterDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      const count = countMap.get(dateString) || 0;
      
      console.log('Processing date:', dateString, 'Count:', count);
      
      filledData.push({
        reportDate: dateString,
        totalScans: count
      });
      
      // Move to next day
      iterDate.setDate(iterDate.getDate() + 1);
    }

    // Calculate summary statistics
    const totalScans = filledData.reduce((sum, day) => sum + day.totalScans, 0);
    const averagePerDay = filledData.length > 0 ? totalScans / filledData.length : 0;
    
    // Get last 7 days vs previous 7 days for trend calculation
    const reversedData = [...filledData].reverse(); // Most recent first
    const last7Days = reversedData.slice(0, Math.min(7, reversedData.length));
    const previous7Days = reversedData.slice(7, Math.min(14, reversedData.length));
    
    const last7DaysTotal = last7Days.reduce((sum, day) => sum + day.totalScans, 0);
    const previous7DaysTotal = previous7Days.reduce((sum, day) => sum + day.totalScans, 0);
    
    let percentageChange = 0;
    if (previous7DaysTotal > 0) {
      percentageChange = ((last7DaysTotal - previous7DaysTotal) / previous7DaysTotal) * 100;
    } else if (last7DaysTotal > 0) {
      percentageChange = 100; // 100% increase from 0
    }

    console.log('Final summary:', {
      totalDays: filledData.length,
      totalScans,
      last7DaysTotal,
      previous7DaysTotal,
      percentageChange
    });

    res.status(200).json({
      success: true,
      data: reversedData, // Most recent first
      summary: {
        totalDays: filledData.length,
        totalScans: totalScans,
        averagePerDay: Math.round(averagePerDay * 100) / 100,
        weeklyTrend: {
          last7Days: last7DaysTotal,
          previous7Days: previous7DaysTotal,
          percentageChange: Math.round(percentageChange * 100) / 100,
          trend: percentageChange > 0 ? 'increasing' : percentageChange < 0 ? 'decreasing' : 'stable'
        },
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        filters: filters
      }
    });

  } catch (error) {
    console.error('Daily Scan Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily scan report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Quick test function - add this temporarily to debug
const testDateLogic = () => {
  const end = new Date(); // Today (June 1, 2025)
  const start = new Date();
  start.setDate(start.getDate() - 7); // 7 days ago
  
  console.log('Test dates:');
  console.log('Start:', start.toISOString());
  console.log('End:', end.toISOString());
  
  const iterDate = new Date(start);
  const endNormalized = new Date(end);
  iterDate.setHours(0, 0, 0, 0);
  endNormalized.setHours(0, 0, 0, 0);
  
  console.log('Normalized:');
  console.log('Start:', iterDate.toISOString());
  console.log('End:', endNormalized.toISOString());
  
  const dates = [];
  while (iterDate <= endNormalized) {
    dates.push(iterDate.toISOString().split('T')[0]);
    iterDate.setDate(iterDate.getDate() + 1);
  }
  
  console.log('Generated dates:', dates);
};

// Get total scan count
const getTotalScanCount = async (req, res) => {
  try {
    const { kioskId, buildingId } = req.query;
    
    const filters = {};
    if (kioskId) filters.kioskId = kioskId;
    if (buildingId) filters.buildingId = buildingId;
    
    const totalCount = await QrScanLog.getTotalScanCount(filters);

    res.status(200).json({
      success: true,
      data: {
        totalScans: totalCount,
        filters: filters
      }
    });

  } catch (error) {
    console.error('Total Scan Count Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch total scan count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get recent scan logs
const getRecentScanLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, kioskId, buildingId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (kioskId) query.kioskId = kioskId;
    if (buildingId) query.buildingId = buildingId;

    const logs = await QrScanLog.find(query)
      .sort({ scannedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-userAgent -ipAddress') // Exclude sensitive data
      .lean();

    const totalLogs = await QrScanLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLogs / limit),
          totalLogs,
          hasMore: skip + logs.length < totalLogs
        }
      }
    });

  } catch (error) {
    console.error('Recent Scan Logs Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent scan logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get building and kiosk statistics
const getBuildingKioskStats = async (req, res) => {
  try {
    const stats = await QrScanLog.aggregate([
      {
        $group: {
          _id: {
            buildingId: '$buildingId',
            buildingName: '$buildingName',
            kioskId: '$kioskId'
          },
          totalScans: { $sum: 1 },
          lastScan: { $max: '$scannedAt' },
          firstScan: { $min: '$scannedAt' }
        }
      },
      {
        $group: {
          _id: {
            buildingId: '$_id.buildingId',
            buildingName: '$_id.buildingName'
          },
          totalScans: { $sum: '$totalScans' },
          kioskCount: { $sum: 1 },
          lastActivity: { $max: '$lastScan' },
          firstActivity: { $min: '$firstScan' },
          kiosks: {
            $push: {
              kioskId: '$_id.kioskId',
              totalScans: '$totalScans',
              lastScan: '$lastScan',
              firstScan: '$firstScan'
            }
          }
        }
      },
      {
        $project: {
          buildingId: '$_id.buildingId',
          buildingName: '$_id.buildingName',
          totalScans: 1,
          kioskCount: 1,
          lastActivity: 1,
          firstActivity: 1,
          kiosks: 1,
          _id: 0
        }
      },
      { $sort: { totalScans: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Building Kiosk Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch building and kiosk statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  logQrScan,
  getDailyScanReport,
  getTotalScanCount,
  getRecentScanLogs,
  getBuildingKioskStats
};