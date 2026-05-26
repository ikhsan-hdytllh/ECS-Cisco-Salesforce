export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 11);
};

export const getCiscoQuarter = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  
  let fy = year;
  if (month >= 7) { 
    fy = year + 1;
  }

  let q = '';
  if (month >= 7 && month <= 9) q = 'Q1';
  else if (month >= 10 || month === 0) q = 'Q2';
  else if (month >= 1 && month <= 3) q = 'Q3';
  else if (month >= 4 && month <= 6) q = 'Q4';

  return `FY${fy.toString().slice(-2)}${q}`;
};
