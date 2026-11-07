/** The offices listed under About > Directory. */

export interface Office {
  name: string;
  address: string;
  phone: string;
  hours: string;
}

export const OFFICE_DIRECTORY: Office[] = [
  { name: 'Bureau of Agricultural Statistics', address: 'Landing Road, Lucena City, Quezon 4301', phone: '(042) 710-7626', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Bureau of Immigration', address: '2nd Floor, Quezon Provincial Capitol Building, Lucena City, Quezon 4301', phone: '(042) 710-7015', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Bureau of Treasury', address: 'Lucena City Grand Central Terminal, Diversion Road, Ilayang Dupay, Lucena City, Quezon 4301', phone: '(042) 710-2195', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: "City Engineer's Office", address: 'Dalahican Road, Lucena City, Quezon 4301', phone: '(042) 373-5947', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'City Government of Lucena – City Population Office', address: 'Old City Hall, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 660-3783', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'City Government of Lucena – Public Market Office', address: 'Old Manila South Road, VI, Lucena City, Quezon 4301', phone: '(042) 710-6885', hours: 'Monday–Saturday, 9:00 AM–5:00 PM' },
  { name: 'City Human Resource Management Office', address: 'Old City Hall, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 373-1329', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Commission on Elections – Lucena City', address: 'City Hall Annex Building, Isabang, Lucena City, Quezon 4301', phone: '(042) 710-4769', hours: 'Monday–Saturday, 8:00 AM–5:00 PM' },
  { name: 'Cooperative Insular of the Philippines', address: 'Leon Guinto Street corner Granja Street, Lucena City, Quezon 4301', phone: '0919-817-2980', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Department of Agrarian Reform – Provincial Office Quezon 1', address: 'Unnamed Road, Lucena City, Quezon 4301', phone: '(042) 710-3998', hours: 'Monday, 9:00 AM–6:00 PM; Tuesday–Friday, 8:00 AM–6:00 PM' },
  { name: 'Department of Information and Communications Technology – Quezon', address: 'Sanggumay, Zaballero Subdivision, Lucena City, Quezon 4301', phone: '(042) 322-0851', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Department of Science and Technology – Quezon', address: 'Unnamed Road, Lucena City, Quezon 4301', phone: '0915-774-9373', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'DPWH Quezon 2nd District Engineering Office', address: 'Dalahican Road, Lucena City, Quezon 4301', phone: '(042) 373-4252', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Department of Trade and Industry – Quezon Provincial Office', address: 'Merchan Street corner Enverga Street, Lucena City, Quezon 4301', phone: '(042) 660-7657', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'General Services Office – Lucena City', address: '3rd Floor, City Hall Building, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 710-8890', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Guard House', address: 'Government Complex Compound, Lucena City, Quezon 4301', phone: '(042) 710-4050', hours: 'Open 24 hours' },
  { name: 'Gulang-Gulang Operators and Drivers Transport Service and Multi-Purpose Cooperative', address: 'Quezon Avenue, Gulang-Gulang, Lucena City, Quezon 4301', phone: '0920-576-0632', hours: 'Monday–Saturday, 8:00 AM–5:00 PM' },
  { name: 'Health Clinic', address: 'Purok Maligaya, Ibabang Dupay, Lucena City, Quezon 4301', phone: '(042) 373-1514', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Community Affairs Office', address: 'Old City Hall, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 373-7524', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Cooperative Development', address: 'Old City Hall, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 373-7524', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Disaster Risk Reduction and Management Council Operations Center', address: 'Beside Super Metro, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 710-4050', hours: 'Open 24 hours' },
  { name: 'Lucena City Government Complex', address: 'Pan-Philippine Highway, Isabang, Lucena City, Quezon 4301', phone: '(042) 373-5931', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Hall', address: 'St. Benedict Street, Ibabang Dupay, Lucena City, Quezon 4301', phone: '(042) 373-5931', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Hall – New Building', address: 'St. Benedict Street, Ibabang Dupay, Lucena City, Quezon 4301', phone: '(042) 373-5931', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Special Programs Unit', address: 'Old City Hall, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 373-5934', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Tri-Media Association', address: 'Lucena City Hall, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 373-5931', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Veterinary Office', address: 'Ground Floor, City Hall Annex, Isabang, Lucena City, Quezon 4301', phone: '(042) 373-4772', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena City Zoning Office', address: 'Old City Hall, M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 710-4210', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena Council for Culture and the Arts (LCCA)', address: 'Luisa Restaurant, Quezon Avenue, Lucena City, Quezon 4301', phone: '(042) 660-5126', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Lucena ERT Base', address: 'M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 797-0441', hours: 'Open 24 hours' },
  { name: 'Office of the City Administrator', address: 'Old City Hall, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 795-3834', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Office of the City Mayor', address: 'Old City Hall, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 373-5931', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Outpost – Himpilan', address: 'Ramon Senior Street corner RGR Avenue Subdivision, Kanlurang Mayao, Lucena City, Quezon 4301', phone: '(042) 710-4050', hours: 'Open 24 hours' },
  { name: 'Philippine Coconut Authority', address: 'Isabang, Lucena City, Quezon 4301', phone: '(042) 373-1407', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Philippine Ports Authority', address: 'Trinidad Street, 2, Lucena City, Quezon 4301', phone: '(042) 710-3400', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Philippine Public School Teachers Association', address: 'QPSTA Building, Old Manila South Road, Lucena City, Quezon 4301', phone: '(042) 795-0135', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: "Provincial Engineer's Office", address: 'Capitol Compound, Merchan Street, Lucena City, Quezon 4301', phone: '(042) 710-5593', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: "Provincial Governor's Office", address: 'Quezon Capitol Compound, Perez Avenue, Lucena City, Quezon 4301', phone: '(042) 373-6007', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Provincial Information and Communications Technology Office', address: 'Finance Building, Quezon Provincial Government Center, Belen Drive, Capitol Compound, Lucena City, Quezon 4301', phone: '(042) 797-1018', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Provincial Information Management Office', address: 'Finance Building, Perez Avenue, Lucena City, Quezon 4301', phone: '(042) 373-0007', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Provincial Information Office – Province of Quezon', address: 'Quezon Provincial Capitol Compound, Lucena City, Quezon 4301', phone: '(042) 373-6007', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'QPGOEMPC Building', address: 'Merchan Street, Quezon Convention Center, Lucena City, Quezon 4301', phone: '0917-384-0477', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Quezon Provincial Capitol', address: '230 Merchan Street, Lucena City, Quezon 4301', phone: '(042) 797-1018', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Quezon Provincial Capitol Building', address: '230 Merchan Street, Lucena City, Quezon 4301', phone: '(042) 797-1018', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Quezon Provincial Department of Health Office', address: 'Quezon Avenue, Lucena City, Quezon 4301', phone: '(042) 373-1514', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Quezon Provincial Jail', address: 'Capitol Compound, Lucena City, Quezon 4301', phone: '(042) 710-2525', hours: 'Open 24 hours' },
  { name: 'Quezon Provincial Tourism Office', address: 'Quezon Convention Center, Quezon Capitol Compound, Lucena City, Quezon 4301', phone: '(042) 373-7510', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Quezon-Lucena Chamber of Commerce and Industry Business Center', address: '2nd Floor, Dinglasan Building, Quezon Avenue, Lucena City, Quezon 4301', phone: '(042) 710-3050', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Regional Trial Court', address: 'Hall of Justice, Lucena City, Quezon 4301', phone: '(042) 373-1250', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Registry of Deeds – Lucena City', address: 'City Hall Annex Building, Isabang, Lucena City, Quezon 4301', phone: '(042) 710-2072', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
  { name: 'Schools Division Office – Lucena City', address: 'M.L. Tagarao Street, Lucena City, Quezon 4301', phone: '(042) 660-3276', hours: 'Monday–Friday, 8:00 AM–5:00 PM' },
];

/** Offices whose name, address or number contain every word of the query. */
export function searchOffices(query: string): Office[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return OFFICE_DIRECTORY.filter((office) => {
    const text = `${office.name} ${office.address} ${office.phone}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
