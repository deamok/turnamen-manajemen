export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 9);
}

export function formatTanggal(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatRentangTanggal(startDateStr, endDateStr) {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const startDay = start.getDate();
  const endDay = end.getDate();
  
  const startMonth = start.toLocaleDateString('id-ID', { month: 'long' });
  const endMonth = end.toLocaleDateString('id-ID', { month: 'long' });
  const year = end.getFullYear();

  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startDay} s/d ${endDay} ${endMonth} ${year}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${startDay} ${startMonth} s/d ${endDay} ${endMonth} ${year}`;
  } else {
    return `${startDay} ${startMonth} ${start.getFullYear()} s/d ${endDay} ${endMonth} ${year}`;
  }
}

export function hitungUmur(tanggalLahir) {
  if (!tanggalLahir) return 0;
  const birthDate = new Date(tanggalLahir);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function acakArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function buatPasangan(pemainArray) {
  const shuffled = acakArray(pemainArray);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairs.push({
        id: generateId(),
        pemain1: shuffled[i],
        pemain2: shuffled[i + 1]
      });
    } else {
      pairs.push({
        id: generateId(),
        pemain1: shuffled[i],
        pemain2: null
      });
    }
  }
  return pairs;
}

/**
 * Resize and compress image file to maximum allowed size (default <= 130KB)
 * @param {File|Blob} file - Original image file
 * @param {number} maxBytes - Maximum file size in bytes (default 130 * 1024)
 * @returns {Promise<string>} Base64 Data URL string
 */
export function compressImage(file, maxBytes = 130 * 1024) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Cap initial maximum dimension to 1200px
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Iterative reduction of quality
        while (dataUrl.length * 0.75 > maxBytes && quality > 0.15) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // If still > maxBytes, downscale dimensions
        if (dataUrl.length * 0.75 > maxBytes) {
          let scale = 0.8;
          while (dataUrl.length * 0.75 > maxBytes && scale > 0.15) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.max(100, Math.round(width * scale));
            tempCanvas.height = Math.max(100, Math.round(height * scale));
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
            dataUrl = tempCanvas.toDataURL('image/jpeg', 0.55);
            scale -= 0.12;
          }
        }

        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Parse match score to [setsPlayer1, setsPlayer2]
 * Supports set-only format [3, 1] as well as legacy formats [[11, 9], ...] and [{a: 11, b: 9}]
 */
export function parseMatchScore(skor) {
  if (!skor) return [0, 0];
  if (!Array.isArray(skor)) return [0, 0];
  if (skor.length === 0) return [0, 0];

  // Case 1: Simple 1D array of 2 numbers [set1, set2] e.g. [3, 1]
  if (skor.length === 2 && typeof skor[0] !== 'object' && !Array.isArray(skor[0])) {
    return [parseInt(skor[0]) || 0, parseInt(skor[1]) || 0];
  }

  // Case 2: Nested array [[3, 1]] or [[11, 9], [8, 11], [11, 5]]
  if (Array.isArray(skor[0])) {
    if (skor.length === 1 && (parseInt(skor[0][0]) <= 7 && parseInt(skor[0][1]) <= 7)) {
      return [parseInt(skor[0][0]) || 0, parseInt(skor[0][1]) || 0];
    }
    let s1 = 0, s2 = 0;
    skor.forEach(set => {
      const p1 = parseInt(set[0]) || 0;
      const p2 = parseInt(set[1]) || 0;
      if (p1 > p2) s1++;
      else if (p2 > p1) s2++;
    });
    return [s1, s2];
  }

  // Case 3: Array of objects [{a: 3, b: 1}] or [{a: 11, b: 9}]
  if (typeof skor[0] === 'object') {
    if (skor.length === 1 && ((skor[0].a ?? 0) <= 7 && (skor[0].b ?? 0) <= 7)) {
      return [parseInt(skor[0].a) || 0, parseInt(skor[0].b) || 0];
    }
    let s1 = 0, s2 = 0;
    skor.forEach(set => {
      const p1 = parseInt(set.a ?? set[0]) || 0;
      const p2 = parseInt(set.b ?? set[1]) || 0;
      if (p1 > p2) s1++;
      else if (p2 > p1) s2++;
    });
    return [s1, s2];
  }

  return [0, 0];
}

/**
 * Format match score for display, e.g. "3 - 1"
 */
export function formatMatchScore(skor) {
  if (!skor) return '-';
  const [s1, s2] = parseMatchScore(skor);
  if (s1 === 0 && s2 === 0 && (!Array.isArray(skor) || skor.length === 0)) return '-';
  return `${s1} - ${s2}`;
}

/**
 * Check if a match is truly finished with a valid score (not 0 - 0, has winner, finished = true)
 */
export function isMatchFinished(match) {
  if (!match || match.isBye) return false;
  const [s1, s2] = parseMatchScore(match.skor);
  if (s1 === 0 && s2 === 0) return false;
  return Boolean(match.selesai && match.pemenang && (s1 > 0 || s2 > 0));
}

