import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SUPPLIERS = [
  { code: 'SUP-001', name: 'Genius Distribution Lanka', contactPerson: 'Mr. Nimal Perera', phone: '+94 11 234 5678', email: 'sales@genius.lk', address: 'No. 45, Baseline Road, Colombo 09', city: 'Colombo', company: 'GENIUS' },
  { code: 'SUP-002', name: 'TechWorld Imports (Pvt) Ltd', contactPerson: 'Ms. Sanduni Fernando', phone: '+94 77 123 4567', email: 'orders@techworld.lk', address: 'Level 3, Liberty Plaza, Colombo 03', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-003', name: 'Singer Sri Lanka PLC', contactPerson: 'Mr. Kasun Jayawardena', phone: '+94 11 470 4700', email: 'b2b@singer.lk', address: 'No. 308, T B Jayah Mawatha, Colombo 10', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-004', name: 'Softlogic Computer House', contactPerson: 'Mr. Ruwan Silva', phone: '+94 11 576 5765', email: 'procurement@softlogic.lk', address: 'No. 75, Union Place, Colombo 02', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-005', name: 'Barclays Computers', contactPerson: 'Mr. Dinesh Ratnayake', phone: '+94 11 268 2682', email: 'sales@barclays.lk', address: 'No. 28, Duplication Road, Colombo 04', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-006', name: 'Redline Technologies', contactPerson: 'Ms. Anjali Gunasekara', phone: '+94 77 890 1234', email: 'info@redline.lk', address: 'No. 12, Nawala Road, Nugegoda', city: 'Nugegoda', company: 'ACTIVE24' },
  { code: 'SUP-007', name: 'Metro Office Supplies', contactPerson: 'Mr. Pradeep Wijesinghe', phone: '+94 11 485 6789', email: 'orders@metrooffice.lk', address: 'No. 56, Galle Road, Dehiwala', city: 'Dehiwala', company: 'ACTIVE24' },
  { code: 'SUP-008', name: 'Lanka Cable Mart', contactPerson: 'Mr. Sunil Mendis', phone: '+94 11 276 5432', email: 'sales@lankacable.lk', address: 'No. 89, Main Street, Pettah', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-009', name: 'Digital Solutions Hub', contactPerson: 'Ms. Tharushi Karunaratne', phone: '+94 76 543 2109', email: 'contact@digitalsolutions.lk', address: 'No. 34, Kandy Road, Kiribathgoda', city: 'Kiribathgoda', company: 'ACTIVE24' },
  { code: 'SUP-010', name: 'Global IT Partners', contactPerson: 'Mr. Chaminda Dias', phone: '+94 11 312 9876', email: 'partners@globalit.lk', address: 'No. 67, High Level Road, Maharagama', city: 'Maharagama', company: 'ACTIVE24' },
  { code: 'SUP-011', name: 'Office Mart Lanka', contactPerson: 'Ms. Nadeesha Perera', phone: '+94 11 498 7654', email: 'sales@officemart.lk', address: 'No. 23, Station Road, Negombo', city: 'Negombo', company: 'ACTIVE24' },
  { code: 'SUP-012', name: 'PC House Kandy', contactPerson: 'Mr. Mahesh Bandara', phone: '+94 81 222 3344', email: 'orders@pchousekandy.lk', address: 'No. 15, Peradeniya Road, Kandy', city: 'Kandy', company: 'ACTIVE24' },
  { code: 'SUP-013', name: 'Elite Peripherals', contactPerson: 'Mr. Roshan Fernando', phone: '+94 77 654 3210', email: 'info@eliteperipherals.lk', address: 'No. 78, Lake Road, Boralesgamuwa', city: 'Boralesgamuwa', company: 'ACTIVE24' },
  { code: 'SUP-014', name: 'Network Pro Lanka', contactPerson: 'Ms. Dilani Wickramasinghe', phone: '+94 11 567 8901', email: 'sales@networkpro.lk', address: 'No. 41, Havelock Road, Colombo 05', city: 'Colombo', company: 'ACTIVE24' },
  { code: 'SUP-015', name: 'Smart Storage Solutions', contactPerson: 'Mr. Isuru Jayasinghe', phone: '+94 76 789 0123', email: 'orders@smartstorage.lk', address: 'No. 92, Industrial Zone, Katunayake', city: 'Katunayake', company: 'ACTIVE24' },
];

const CUSTOMERS = [
  { name: 'Colombo City Computers', mobile: '+94 77 111 2233', address: 'No. 12, Main Street, Pettah, Colombo 11', email: 'info@colombocity.lk', type: 'BUSINESS' },
  { name: 'Kandy Tech Solutions', mobile: '+94 81 234 5678', address: 'No. 45, Peradeniya Road, Kandy', email: 'sales@kandytech.lk', type: 'BUSINESS' },
  { name: 'Mr. Ajith Kumara', mobile: '+94 77 345 6789', address: 'No. 78, High Level Road, Nugegoda', email: 'ajith.k@gmail.com', type: 'INDIVIDUAL' },
  { name: 'Galle Digital Hub', mobile: '+94 91 223 4455', address: 'No. 23, Lighthouse Street, Galle', email: 'contact@galledigital.lk', type: 'BUSINESS' },
  { name: 'Ms. Priyanka Silva', mobile: '+94 76 567 8901', address: 'No. 56, Galle Road, Mount Lavinia', email: 'priyanka.s@outlook.com', type: 'INDIVIDUAL' },
  { name: 'Walk-in Customer', mobile: '-', address: '-', email: '-', type: 'WALK_IN' },
  { name: 'Corporate Account - Dialog Axiata', mobile: '+94 11 678 6786', address: 'No. 475, Union Place, Colombo 02', email: 'procurement@dialog.lk', type: 'CORPORATE' },
];

// product: [code, name, description, category, sellingPrice, source, reorderLevel, supplierCode]
const PRODUCTS = [
  ['ACC-MSE-001', 'Genius Wireless Mouse NX-7000', '2.4GHz wireless optical mouse with nano receiver', 'Computer Accessories', 1300, 'GENIUS', 20, 'SUP-001'],
  ['ACC-KBD-001', 'Genius KB-118 Keyboard', 'Standard USB wired keyboard', 'Computer Accessories', 1850, 'GENIUS', 15, 'SUP-001'],
  ['ACC-HPH-001', 'Genius HS-04S Headset', 'Stereo headset with microphone', 'Peripherals', 2750, 'GENIUS', 10, 'SUP-001'],
  ['ACC-WEB-001', 'Genius FaceCam 1000X', '720p HD webcam with built-in microphone', 'Peripherals', 5200, 'GENIUS', 8, 'SUP-001'],
  ['ACC-PAD-001', 'Genius Mouse Pad GMP-100', 'Standard size mouse pad with gel wrist rest', 'Computer Accessories', 550, 'GENIUS', 30, 'SUP-001'],
  ['NET-RTR-001', 'TP-Link Archer C6 Router', 'AC1200 dual-band Wi-Fi router', 'Networking', 12500, 'ACTIVE24', 10, 'SUP-014'],
  ['NET-SWT-001', 'TP-Link 8-Port Switch', 'Gigabit Ethernet desktop switch', 'Networking', 6500, 'ACTIVE24', 8, 'SUP-014'],
  ['STR-SSD-001', 'Samsung 870 EVO 500GB SSD', '2.5" SATA III internal SSD', 'Storage Devices', 24500, 'ACTIVE24', 5, 'SUP-002'],
  ['STR-HDD-001', 'WD Blue 1TB HDD', '3.5" 7200RPM internal hard drive', 'Storage Devices', 13500, 'ACTIVE24', 8, 'SUP-002'],
  ['STR-PEN-001', 'SanDisk 64GB USB Flash Drive', 'USB 3.0 flash drive', 'Storage Devices', 2800, 'ACTIVE24', 20, 'SUP-015'],
  ['CAB-HDMI-001', 'HDMI Cable 2m', 'High-speed HDMI cable with Ethernet', 'Cables & Adapters', 1100, 'ACTIVE24', 15, 'SUP-008'],
  ['CAB-USB-001', 'USB Type-C Cable 1m', 'USB-C to USB-A charging cable', 'Cables & Adapters', 850, 'ACTIVE24', 25, 'SUP-008'],
  ['CAB-LAN-001', 'Cat6 Ethernet Cable 5m', 'Cat6 UTP patch cable', 'Cables & Adapters', 950, 'ACTIVE24', 20, 'SUP-008'],
  ['OFF-PAP-001', 'A4 Copy Paper 500 Sheets', '80gsm white A4 printing paper', 'Office Supplies', 1250, 'ACTIVE24', 50, 'SUP-007'],
  ['OFF-PEN-001', 'Pilot Ballpoint Pen Box (12)', 'Blue ink ballpoint pens', 'Office Supplies', 980, 'ACTIVE24', 15, 'SUP-007'],
  ['OFF-STP-001', 'Stapler Heavy Duty', 'Metal stapler with 1000 staples', 'Office Supplies', 1850, 'ACTIVE24', 10, 'SUP-007'],
  ['ELC-MON-001', 'Dell 24" Monitor P2422H', 'Full HD IPS monitor with adjustable stand', 'Electronics', 55000, 'ACTIVE24', 3, 'SUP-004'],
  ['ELC-LPT-001', 'HP Laptop 15s-fq5000', 'Intel Core i5, 8GB RAM, 512GB SSD', 'Electronics', 175000, 'ACTIVE24', 2, 'SUP-004'],
  ['ACC-MSE-002', 'Logitech M185 Mouse', 'Compact wireless mouse', 'Computer Accessories', 3200, 'ACTIVE24', 12, 'SUP-005'],
  ['ACC-KBD-002', 'Logitech K380 Keyboard', 'Multi-device Bluetooth keyboard', 'Computer Accessories', 8900, 'ACTIVE24', 5, 'SUP-005'],
  ['ACC-HPH-002', 'Logitech H111 Headset', 'Stereo headset for PC', 'Peripherals', 4200, 'ACTIVE24', 10, 'SUP-005'],
  ['NET-AP-001', 'TP-Link EAP225 Access Point', 'Ceiling mount wireless access point', 'Networking', 16800, 'ACTIVE24', 5, 'SUP-014'],
  ['NET-MOD-001', 'Huawei 4G LTE Router', '4G LTE wireless router with SIM slot', 'Networking', 13500, 'ACTIVE24', 5, 'SUP-006'],
  ['STR-SSD-002', 'Kingston NV2 1TB NVMe SSD', 'M.2 NVMe PCIe Gen4 SSD', 'Storage Devices', 28500, 'ACTIVE24', 4, 'SUP-002'],
  ['STR-EXT-001', 'Seagate 2TB External HDD', 'USB 3.0 portable external drive', 'Storage Devices', 19500, 'ACTIVE24', 5, 'SUP-015'],
  ['ACC-SPK-001', 'Genius SP-HF500A Speakers', '2.0 channel desktop speakers', 'Peripherals', 4800, 'GENIUS', 8, 'SUP-001'],
  ['ACC-GAM-001', 'Genius GX Gaming Mouse', 'RGB gaming mouse with 6 buttons', 'Computer Accessories', 4200, 'GENIUS', 8, 'SUP-001'],
  ['ACC-GAM-002', 'Genius Gaming Keyboard', 'Mechanical feel gaming keyboard', 'Computer Accessories', 6800, 'GENIUS', 6, 'SUP-001'],
  ['CAB-ADP-001', 'USB to HDMI Adapter', 'USB 3.0 to HDMI video adapter', 'Cables & Adapters', 5200, 'ACTIVE24', 8, 'SUP-008'],
  ['CAB-ADP-002', 'VGA to HDMI Converter', 'VGA input to HDMI output converter', 'Cables & Adapters', 3500, 'ACTIVE24', 8, 'SUP-008'],
  ['OFF-FIL-001', 'Document File Folders (Pack of 10)', 'A4 size plastic file folders', 'Office Supplies', 750, 'ACTIVE24', 15, 'SUP-007'],
  ['OFF-TAP-001', 'Transparent Tape 12mm (6 Pack)', 'Office adhesive tape rolls', 'Office Supplies', 580, 'ACTIVE24', 20, 'SUP-007'],
  ['SW-SYS-001', 'Windows 11 Pro License', 'Retail license key for Windows 11 Pro', 'Software', 35000, 'ACTIVE24', 3, 'SUP-009'],
  ['SW-AV-001', 'Kaspersky Total Security 1Y', '1 device 1 year antivirus license', 'Software', 6500, 'ACTIVE24', 8, 'SUP-009'],
  ['SW-OFF-001', 'Microsoft Office 365 Personal', '1 year subscription license', 'Software', 11500, 'ACTIVE24', 5, 'SUP-009'],
  ['ELC-UPS-001', 'APC 650VA UPS', 'Line interactive UPS with AVR', 'Electronics', 24500, 'ACTIVE24', 4, 'SUP-003'],
  ['ELC-PWR-001', '650W Power Supply Unit', '80+ Bronze certified PSU', 'Electronics', 11800, 'ACTIVE24', 3, 'SUP-010'],
  ['ACC-HUB-001', 'USB 3.0 Hub 4-Port', 'Powered USB hub with 4 ports', 'Computer Accessories', 2800, 'ACTIVE24', 10, 'SUP-013'],
  ['ACC-DCK-001', 'Laptop Docking Station', 'USB-C docking station with dual display', 'Computer Accessories', 29500, 'ACTIVE24', 2, 'SUP-013'],
  ['ACC-BAG-001', 'Laptop Bag 15.6"', 'Padded laptop carrying bag', 'Computer Accessories', 3500, 'ACTIVE24', 10, 'SUP-011'],
  ['NET-CAM-001', 'Hikvision IP Camera 2MP', 'Indoor dome IP security camera', 'Networking', 11800, 'ACTIVE24', 3, 'SUP-006'],
  ['NET-NVR-001', '4-Channel NVR System', 'Network video recorder with 1TB HDD', 'Networking', 45000, 'ACTIVE24', 2, 'SUP-006'],
  ['ACC-MSE-003', 'Genius Ergonomic Mouse', 'Vertical ergonomic wireless mouse', 'Computer Accessories', 4800, 'GENIUS', 5, 'SUP-001'],
  ['STR-MEM-001', 'Kingston 8GB DDR4 RAM', '2666MHz laptop memory module', 'Storage Devices', 8900, 'ACTIVE24', 4, 'SUP-002'],
  ['STR-MEM-002', 'Kingston 16GB DDR4 RAM', '3200MHz desktop memory module', 'Storage Devices', 16500, 'ACTIVE24', 3, 'SUP-002'],
  ['OFF-WHT-001', 'Whiteboard Marker Set (4 Colors)', 'Dry erase markers for whiteboards', 'Office Supplies', 750, 'ACTIVE24', 10, 'SUP-007'],
  ['ACC-CLN-001', 'Screen Cleaning Kit', 'LCD screen cleaner with microfiber cloth', 'Computer Accessories', 1100, 'ACTIVE24', 10, 'SUP-011'],
  ['CAB-PWR-001', 'Laptop Power Adapter Universal', 'Universal 65W laptop charger', 'Cables & Adapters', 5200, 'ACTIVE24', 5, 'SUP-008'],
  ['NET-WIFI-001', 'WiFi Range Extender AC750', 'Dual-band WiFi range extender', 'Networking', 7800, 'ACTIVE24', 5, 'SUP-014'],
  ['ACC-STD-001', 'Monitor Stand Riser', 'Adjustable monitor stand with storage', 'Computer Accessories', 6800, 'ACTIVE24', 6, 'SUP-013'],
];

async function seedUsers() {
  const users = [
    { name: 'System Manager', email: 'manager@active24.lk', role: 'MANAGER', password: process.env.SEED_MANAGER_PASSWORD || 'Manager@123' },
    { name: 'System Admin', email: 'admin@active24.lk', role: 'ADMIN', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123' },
    { name: 'Front Cashier', email: 'cashier@active24.lk', role: 'CASHIER', password: process.env.SEED_CASHIER_PASSWORD || 'Cashier@123' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, isActive: true },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
  }
  console.log(`Seeded ${users.length} users (manager / admin / cashier).`);
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'Active24 (Pvt) Ltd',
      companyAddress: 'No. 128, Duplication Road, Colombo 04, Sri Lanka',
      companyPhone: '+94 11 456 7890',
      companyEmail: 'info@active24.lk',
      invoicePrefix: 'INV-2026-',
      defaultPaymentMethod: 'CASH',
      vatRate: 0,
      vatEnabled: true,
      currency: 'LKR',
      lowStockThreshold: 10,
    },
  });
  console.log('Seeded settings (single row).');
}

async function seedCategories() {
  const names = [...new Set(PRODUCTS.map((p) => p[3]))];
  const map = {};
  for (const name of names) {
    const cat = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    map[name] = cat.id;
  }
  console.log(`Seeded ${names.length} categories.`);
  return map;
}

async function seedSuppliers() {
  const map = {};
  for (const s of SUPPLIERS) {
    const sup = await prisma.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, contactPerson: s.contactPerson, phone: s.phone, email: s.email, address: s.address, city: s.city, company: s.company },
      create: s,
    });
    map[s.code] = sup.id;
  }
  console.log(`Seeded ${SUPPLIERS.length} suppliers.`);
  return map;
}

async function seedCustomers() {
  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.customer.create({ data: c });
    }
  }
  console.log(`Seeded ${CUSTOMERS.length} customers.`);
}

async function seedProducts(categoryMap, supplierMap) {
  for (const [code, name, description, category, sellingPrice, source, reorderLevel, supplierCode] of PRODUCTS) {
    await prisma.product.upsert({
      where: { code },
      update: {
        name,
        description,
        categoryId: categoryMap[category],
        company: source,
        defaultSellingPrice: sellingPrice,
        reorderLevel,
        supplierId: supplierMap[supplierCode],
      },
      create: {
        code,
        name,
        description,
        categoryId: categoryMap[category],
        company: source,
        defaultSellingPrice: sellingPrice,
        reorderLevel,
        supplierId: supplierMap[supplierCode],
      },
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products (catalog only; stock arrives via GRN).`);
}

async function main() {
  console.log('Seeding Active24 database...');
  await seedUsers();
  await seedSettings();
  const categoryMap = await seedCategories();
  const supplierMap = await seedSuppliers();
  await seedCustomers();
  await seedProducts(categoryMap, supplierMap);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
