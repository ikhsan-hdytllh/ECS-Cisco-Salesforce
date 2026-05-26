import { Deal } from './types';
import { getAccessToken } from './auth';

const SPREADSHEET_ID = '1joDueM7OIobWRv16j0IuYUIVv_vjA4gqrR6kSUHOpNw';
const RANGE = 'Sheet1!A:P'; // Assuming 'Sheet1' is the first sheet, we will define columns.

// P = 16 columns.
const COLUMNS = [
  'id', 'Product', 'Enduser', 'Partner', 'AM_Cisco', 'DID', 'Estimate', 'Pricelist', 'Disc', 'Value_Net', 'Archi', 'Stage', 'Req_Masuk_Date', 'Req_Masuk', 'Estimate_Close_Date', 'Estimate_Close', 'Channel_ECS', 'PIC_Presales', 'Remarks'
];

export const fetchDealsFromSheets = async (): Promise<Deal[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:S`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    if (res.status === 404) {
        // Just return empty, it might be the sheet doesn't exist yet but let's assume it failed
        console.error('Sheet not found');
        return [];
    }
    throw new Error('Failed to fetch from sheets');
  }

  const data = await res.json();
  const rows = data.values || [];
  
  if (rows.length <= 1) return []; // Empty or only headers

  const headers = rows[0];
  
  return rows.slice(1).map((row: any[]) => {
    const deal: any = {};
    headers.forEach((header: string, index: number) => {
      let val = row[index] || '';
      // parse numeric
      if (['Pricelist', 'Disc', 'Value_Net', 'Stage'].includes(header)) {
        val = Number(val) || 0;
      }
      deal[header] = val;
    });
    return deal as Deal;
  });
};

export const syncDealsToSheets = async (deals: Deal[]) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const headers = COLUMNS;
  const values = [
    headers,
    ...deals.map(deal => headers.map(header => (deal as any)[header] !== undefined ? (deal as any)[header] : ''))
  ];

  // We use the PUT request to upload the entire table (overwriting)
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:S?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    // If we get an error about "Sheet1" not found, we should ideally handle it, but fallback to typical default.
    throw new Error('Failed to sync to sheets');
  }
};
