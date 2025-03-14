  // Regular expressions for detecting sensitive data
  export const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
    phoneNumber: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    apiKey: /(?:api|key|token|secret)[_]?[a-zA-Z0-9]{16,}/gi,
    password: /(?:password|pwd|pass|secret)[=:"'\s][a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{8,}/gi,
    awsKey: /(AKIA[0-9A-Z]{16})/g,
    jwtToken: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    driverLicense: /(driver'?s\s*license|dl\s*number)\s*[:\s]*[A-Za-z0-9-]{6,}/gi,
    passport: /(passport\s*number|passport\s*no)\s*[:\s]*[A-Za-z0-9]{6,}/gi,
    idNumber: /(id\s*number|id\s*no|national\s*id)\s*[:\s]*[A-Za-z0-9-]{6,}/gi,
    dateOfBirth: /(dob|date\s*of\s*birth)\s*[:\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/gi,
    documentNumber: /[A-Z]{2}\d{6,9}/g,
    registration: /\bregistration\b/gi,
    nursing: /\bnursing\b/gi,
    expiration: /\bexpiration\b/gi,
    facilities: /\bfacilities\b/gi,
    department: /\bdepartment\b/gi,
    healh: /\bhealh\b/gi, // Note: Replace with /\bhealth\b/gi if "healh" is a typo
  };