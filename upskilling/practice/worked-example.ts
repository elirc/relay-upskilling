function cleanCompany(value: string): string {
  return value.trim();
}

const original = '  North  Star  ';
console.log(JSON.stringify(original));
console.log(JSON.stringify(cleanCompany(original)));
console.log(JSON.stringify(original));
