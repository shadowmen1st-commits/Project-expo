export const JOB_CATEGORIES = {
    'Event Management': [
        'Event Marshal',
        'Event Coordinator',
        'Event Assistant',
        'Ticketing Clerk',
        'Registration Desk Staff',
        'Crowd Management Staff',
        'Event Supervisor',
        'Stage Assistant',
        'Backstage Assistant',
        'Venue Assistant',
        'Event Setup Staff',
        'Event Usher',
        'Guest Relations Staff',
        'Event Security Assistant',
        'Event Cleanup Staff'
    ],
    'Hospitality': [
        'Hotel Receptionist',
        'Front Desk Staff',
        'Guest Relations Executive',
        'Housekeeping Staff',
        'Room Attendant',
        'Bell Staff',
        'Hotel Assistant',
        'Restaurant Host',
        'Hotel Supervisor',
        'Banquet Staff'
    ],
    'Food & Catering': [
        'Catering Staff',
        'Catering Assistant',
        'Waiter',
        'Server',
        'Kitchen Helper',
        'Cook',
        'Chef Assistant',
        'Food Counter Staff',
        'Dishwasher',
        'Food Packing Staff',
        'Catering Supervisor',
        'Banquet Server'
    ],
    'Retail & Sales': [
        'Sales Associate',
        'Retail Assistant',
        'Store Helper',
        'Cashier',
        'Store Executive',
        'Sales Promoter',
        'Customer Advisor',
        'Merchandiser',
        'Stock Assistant',
        'Store Supervisor'
    ],
    'Delivery & Logistics': [
        'Delivery Agent',
        'Delivery Executive',
        'Courier Agent',
        'Pickup Agent',
        'Logistics Assistant',
        'Dispatch Assistant',
        'Delivery Coordinator',
        'Route Coordinator',
        'Logistics Supervisor'
    ],
    'Warehouse & Inventory': [
        'Warehouse Worker',
        'Warehouse Assistant',
        'Picker',
        'Packer',
        'Inventory Assistant',
        'Stock Handler',
        'Loading Staff',
        'Unloading Staff',
        'Warehouse Supervisor',
        'Inventory Coordinator'
    ],
    'Office & Administration': [
        'Office Assistant',
        'Data Entry Operator',
        'Receptionist',
        'Administrative Assistant',
        'Office Coordinator',
        'Documentation Assistant',
        'Back Office Executive',
        'Office Supervisor'
    ],
    'Customer Support': [
        'Customer Support Executive',
        'Call Center Executive',
        'Help Desk Assistant',
        'Customer Care Executive',
        'Support Representative',
        'Chat Support Executive',
        'Customer Service Supervisor'
    ],
    'Security': [
        'Security Guard',
        'Security Officer',
        'Security Assistant',
        'Gatekeeper',
        'Event Security Staff',
        'Night Security Guard',
        'Security Supervisor'
    ],
    'Cleaning & Housekeeping': [
        'House Cleaner',
        'Office Cleaner',
        'Housekeeping Staff',
        'Cleaning Assistant',
        'Deep Cleaning Worker',
        'Janitorial Staff',
        'Sanitation Worker',
        'Cleaning Supervisor'
    ],
    'Construction & Labour': [
        'General Labourer',
        'Construction Helper',
        'Mason Helper',
        'Electrician Helper',
        'Plumber Helper',
        'Carpenter Helper',
        'Site Assistant',
        'Construction Supervisor',
        'Loading Labour',
        'Painting Helper'
    ],
    'Healthcare & Caregiving': [
        'Caregiver',
        'Patient Care Assistant',
        'Home Care Assistant',
        'Nursing Assistant',
        'Healthcare Helper',
        'Elder Care Assistant',
        'Medical Receptionist',
        'Care Coordinator'
    ],
    'Education & Tutoring': [
        'Tutor',
        'Teaching Assistant',
        'Home Tutor',
        'Academic Assistant',
        'Exam Invigilator',
        'Classroom Assistant',
        'Education Coordinator'
    ],
    'Marketing & Promotion': [
        'Marketing Assistant',
        'Brand Promoter',
        'Sales Promoter',
        'Field Marketing Executive',
        'Promotional Staff',
        'Brand Ambassador',
        'Marketing Coordinator',
        'Survey Executive'
    ],
    'IT & Technology': [
        'IT Support Assistant',
        'Technical Support Executive',
        'Data Entry Operator',
        'Computer Operator',
        'Junior Web Assistant',
        'QA Tester',
        'IT Assistant',
        'Technical Assistant'
    ],
    'Photography & Videography': [
        'Photographer',
        'Photography Assistant',
        'Videographer',
        'Video Assistant',
        'Camera Assistant',
        'Photo Editor',
        'Video Editor',
        'Event Photographer'
    ],
    'Beauty & Wellness': [
        'Beautician',
        'Salon Assistant',
        'Hair Stylist',
        'Makeup Artist',
        'Spa Assistant',
        'Wellness Assistant',
        'Fitness Trainer',
        'Yoga Instructor'
    ],
    'Transportation': [
        'Driver',
        'Delivery Driver',
        'Cab Driver',
        'Transport Assistant',
        'Driver Helper',
        'Fleet Assistant',
        'Transport Coordinator',
        'Vehicle Attendant'
    ],
    'Manufacturing': [
        'Production Worker',
        'Factory Helper',
        'Machine Operator',
        'Assembly Worker',
        'Packaging Worker',
        'Quality Control Assistant',
        'Production Assistant',
        'Factory Supervisor'
    ],
    'Agriculture': [
        'Farm Worker',
        'Agriculture Helper',
        'Harvesting Worker',
        'Nursery Worker',
        'Field Assistant',
        'Gardener',
        'Farm Supervisor'
    ],
    'Home Services': [
        'Domestic Helper',
        'Home Cleaner',
        'Babysitter',
        'Caregiver',
        'Cook',
        'Gardener',
        'Home Assistant',
        'Pet Care Assistant'
    ],
    'Maintenance & Repair': [
        'Electrician',
        'Plumber',
        'Carpenter',
        'AC Technician',
        'Appliance Technician',
        'Maintenance Assistant',
        'Repair Technician',
        'Maintenance Supervisor'
    ],
    'Tourism & Travel': [
        'Tour Guide',
        'Travel Assistant',
        'Travel Coordinator',
        'Hotel Assistant',
        'Tourist Support Staff',
        'Trip Coordinator',
        'Travel Executive'
    ],
    'Entertainment': [
        'Event Performer',
        'DJ Assistant',
        'Stage Assistant',
        'Artist Assistant',
        'Entertainment Coordinator',
        'Performer',
        'Event Host',
        'Production Assistant'
    ],
    'Other': [
        'General Assistant',
        'Part-Time Worker',
        'Temporary Worker',
        'Helper',
        'General Staff',
        'Other'
    ]
};

export const CATEGORY_LIST = Object.keys(JOB_CATEGORIES);

export const getJobTitlesForCategory = (category) => {
    if (!category || !JOB_CATEGORIES[category]) {
        return [];
    }
    return JOB_CATEGORIES[category];
};

export const isValidCategory = (category) => {
    return Boolean(category && JOB_CATEGORIES[category]);
};

export const isValidCategoryAndTitle = (category, title) => {
    if (!category || !title) return false;
    const titles = JOB_CATEGORIES[category];
    if (!titles) return false;
    return titles.includes(title);
};
