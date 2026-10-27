const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

/**
 * Read student rooms from LTC Rooms Availability.xlsx
 */
const getRoomsFromExcel = () => {
  let xlsxPath = path.join(__dirname, '..', '..', 'LTC Rooms Availability.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    xlsxPath = path.join(__dirname, '..', 'LTC Rooms Availability.xlsx');
  }
  if (!fs.existsSync(xlsxPath)) {
    xlsxPath = path.join(__dirname, 'LTC Rooms Availability.xlsx');
  }
  if (!fs.existsSync(xlsxPath)) {
    throw new Error('LTC Rooms Availability.xlsx file not found.');
  }

  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const sinhgadRooms = [];
  const pratapgadRooms = [];
  let currentFloor = '';

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (row[0]) currentFloor = String(row[0]).trim();

    // Sinhgad room
    if (row[1] && String(row[1]).trim() !== 'Room No') {
      const roomNo = String(row[1]).trim();
      const allottedTo = row[2] ? String(row[2]).trim() : '';
      const capacity = parseInt(row[3]) || 0;
      sinhgadRooms.push({ building: 'Sinhgad', floor: currentFloor, roomNo, allottedTo, capacity, room: `Sinhgad-${roomNo}` });
    }

    // Pratapgad room
    if (row[5] && String(row[5]).trim() !== 'Room No') {
      const roomNo = String(row[5]).trim();
      const allottedTo = row[6] ? String(row[6]).trim() : '';
      const capacity = parseInt(row[7]) || 0;
      pratapgadRooms.push({ building: 'Pratapgad', floor: currentFloor, roomNo, allottedTo, capacity, room: `Pratapgad-${roomNo}` });
    }
  }

  const studentRooms = [...sinhgadRooms, ...pratapgadRooms].filter(r => r.allottedTo.toLowerCase() !== 'faculty');
  return { all: studentRooms, sinhgad: sinhgadRooms, pratapgad: pratapgadRooms };
};

/**
 * Fetch list of rooms with remaining capacity for a given batch.
 */
const getAvailableRoomsForBatch = async (batchId, gender = null) => {
  const { all: studentRooms } = getRoomsFromExcel();

  const occupiedRes = await pool.query(
    `SELECT room, COUNT(*)::int as occupied 
     FROM batch_students 
     WHERE batch_id = $1 AND room IS NOT NULL AND TRIM(LOWER(room)) != 'overfilled' 
     GROUP BY room`,
    [batchId]
  );

  const occupiedMap = {};
  occupiedRes.rows.forEach(r => {
    occupiedMap[r.room] = r.occupied;
  });

  // Fetch unavailable rooms for this batch to exclude them from the manual room selection list
  let unavailableSet = new Set();
  try {
    const batchRes = await pool.query(
      `SELECT unavailable_rooms FROM batches WHERE id = $1`,
      [batchId]
    );
    const rawUnavailable = (batchRes.rows[0]?.unavailable_rooms || []);
    unavailableSet = new Set(
      rawUnavailable.map(r => String(r).trim().toLowerCase())
    );
  } catch (err) {
    console.warn('Could not fetch batch unavailable rooms in getAvailableRoomsForBatch:', err.message);
  }

  const isRoomUnavailable = (roomNo, building, room) => {
    const rNo = String(roomNo || '').trim().toLowerCase();
    const bName = String(building || '').trim().toLowerCase();
    const fullRoom = String(room || `${bName}-${rNo}`).trim().toLowerCase();
    const combined = `${bName}-${rNo}`.toLowerCase();
    return unavailableSet.has(rNo) || unavailableSet.has(combined) || unavailableSet.has(fullRoom);
  };

  const availableRooms = studentRooms
    .filter(r => !isRoomUnavailable(r.roomNo, r.building, r.room))
    .map(r => {
      const occupied = occupiedMap[r.room] || 0;
      const available = Math.max(0, r.capacity - occupied);
      return {
        building: r.building,
        floor: r.floor,
        roomNo: r.roomNo,
        room: r.room,
        capacity: r.capacity,
        occupied,
        available
      };
    })
    .filter(r => r.available > 0);

  if (gender) {
    const g = String(gender).trim().toLowerCase();
    const isFemale = g === 'female' || g === 'f';

    const genderCountRes = await pool.query(
      `SELECT LOWER(TRIM(u.gender)) as gender, COUNT(*)::int as count
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.batch_id = $1
       GROUP BY LOWER(TRIM(u.gender))`,
      [batchId]
    );

    let girlsCount = 0;
    let boysCount = 0;
    genderCountRes.rows.forEach(r => {
      if (r.gender === 'female' || r.gender === 'f') {
        girlsCount += r.count;
      } else {
        boysCount += r.count;
      }
    });

    let femaleBuilding = 'Sinhgad';
    let maleBuilding = 'Pratapgad';
    if (girlsCount > boysCount) {
      femaleBuilding = 'Sinhgad';
      maleBuilding = 'Pratapgad';
    } else if (boysCount > girlsCount) {
      femaleBuilding = 'Pratapgad';
      maleBuilding = 'Sinhgad';
    }

    const preferredBuilding = isFemale ? femaleBuilding : maleBuilding;

    availableRooms.sort((a, b) => {
      if (a.building === preferredBuilding && b.building !== preferredBuilding) return -1;
      if (a.building !== preferredBuilding && b.building === preferredBuilding) return 1;
      return a.room.localeCompare(b.room, undefined, { numeric: true });
    });
  } else {
    availableRooms.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
  }

  return availableRooms;
};

/**
 * Validate selected room for a batch.
 */
const validateRoomAssignment = async (batchId, roomName) => {
  if (!roomName || typeof roomName !== 'string' || !roomName.trim()) {
    return { valid: false, error: 'Room name is required and cannot be empty.' };
  }

  const formattedRoom = roomName.trim();
  if (formattedRoom.toLowerCase() === 'overfilled') {
    return { valid: false, error: 'Please enter a valid room assignment, not Overfilled.' };
  }

  if (formattedRoom.length > 50) {
    return { valid: false, error: 'Room name must be 50 characters or less.' };
  }

  try {
    const { all: studentRooms } = getRoomsFromExcel();
    const matchedRoom = studentRooms.find(r => r.room.toLowerCase() === formattedRoom.toLowerCase());
    if (matchedRoom) {
      return { valid: true, room: matchedRoom.room };
    }
  } catch (err) {
    // fallback if excel error
  }

  return { valid: true, room: formattedRoom };
};

module.exports = {
  getRoomsFromExcel,
  getAvailableRoomsForBatch,
  validateRoomAssignment
};
