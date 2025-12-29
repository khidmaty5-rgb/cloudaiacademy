import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminApp';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

  if (usingEmulators) {
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }

  // Try locating a local service account JSON (mirrors other admin routes)
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const tryPaths: string[] = [];
  if (explicitPath) tryPaths.push(explicitPath);
  const levels = ['', '..', '../..', '../../..', '../../../..'];
  for (const lvl of levels) {
    tryPaths.push(path.join(process.cwd(), lvl, 'config', 'serviceAccount.local.json'));
  }
  for (const p of tryPaths) {
    try {
      if (p && existsSync(p)) {
        const raw = readFileSync(p, 'utf8');
        const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
        const pId = sa.project_id || projectId;
        if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = pId;
        if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = pId;
        const pk = sa.private_key?.includes('\\n') ? sa.private_key.replace(/\\n/g, '\n') : sa.private_key;
        return initializeApp({ credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId }, name);
      }
    } catch {}
  }

  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

// Simple slug helper
function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Seed dataset
const seedCourses: Array<{
  title: string;
  courseCode?: string;
  description: string;
  category: string;
  price: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  totalHours?: number;
  imageId: string;
  lessons: Array<{ title: string; content: string; title_ar?: string; content_ar?: string; embedUrl?: string }>;
}> = [
  {
    title: 'AWS Solutions Architect',
    courseCode: 'AWS-SAA',
    description: 'Design and deploy secure, scalable systems on AWS.',
    category: 'Cloud',
    price: '$199',
    duration: '8 weeks',
    totalHours: 40,
    level: 'Intermediate',
    imageId: 'course-aws',
    lessons: [
      { title: 'Introduction to AWS Cloud', content: 'Overview of AWS global infrastructure, regions, and core services.' },
      { title: 'IAM and Security Basics', content: 'Understand users, roles, policies, and best practices.' },
      { title: 'VPC Networking Fundamentals', content: 'Subnets, route tables, NAT, gateways, and security groups.' },
      { title: 'Compute with EC2 and Auto Scaling', content: 'EC2 instance types, AMIs, Auto Scaling Groups, and Load Balancers.' },
      { title: 'Storage with S3 and EBS', content: 'S3 buckets, lifecycle rules, and EBS volumes & snapshots.' },
    ],
  },
  {
    title: 'Machine Learning Engineering',
    courseCode: 'ML-ENG',
    description: 'Build, train, deploy, and monitor ML systems end to end.',
    category: 'AI/ML',
    price: '$249',
    duration: '10 weeks',
    totalHours: 50,
    level: 'Intermediate',
    imageId: 'course-ml',
    lessons: [
      { title: 'ML Workflows Overview', content: 'Data collection, labeling, training, evaluation, and deployment.' },
      { title: 'Data Preprocessing', content: 'Feature engineering, scaling, splitting, and validation strategies.' },
      { title: 'Model Training & Evaluation', content: 'Cross-validation, metrics, and hyperparameter tuning.' },
      { title: 'Serving with FastAPI', content: 'Package and serve models via REST APIs with FastAPI.' },
      { title: 'Monitoring & Drift', content: 'Detect data drift and performance degradation in production.' },
    ],
  },
  {
    title: 'Azure AI Engineer',
    courseCode: 'AZ-AIENG',
    description: 'Leverage Azure AI services for CV, NLP, and search workloads.',
    category: 'Cloud/AI',
    price: '$229',
    duration: '8 weeks',
    totalHours: 40,
    level: 'Intermediate',
    imageId: 'course-azure',
    lessons: [
      { title: 'Intro to Azure AI', content: 'Overview of Azure Cognitive Services and Azure OpenAI.' },
      { title: 'Computer Vision on Azure', content: 'Image analysis and OCR pipelines.' },
      { title: 'Language & Chat', content: 'Prompting and grounding with Azure OpenAI & Language Studio.' },
      { title: 'Cognitive Search', content: 'Indexing and semantic search across enterprise data.' },
      { title: 'MLOps with Azure ML', content: 'Pipelines, endpoints, and model registries.' },
    ],
  },
  {
    title: 'Full Stack Development',
    courseCode: 'FS-DEV',
    description: 'Build modern web apps with Node, React, and SQL.',
    category: 'Web Dev',
    price: '$149',
    duration: '6 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-full-stack',
    lessons: [
      { title: 'Web Fundamentals', content: 'HTTP, HTML/CSS/JS, and the client–server model.' },
      { title: 'REST APIs with Express', content: 'Routing, middleware, and CRUD patterns.' },
      { title: 'React Basics', content: 'Components, state, and effects.' },
      { title: 'Persistence with PostgreSQL', content: 'Schemas, queries, and migrations.' },
      { title: 'AuthN/Z', content: 'Session vs JWT, authorization patterns and best practices.' },
    ],
  },
  {
    title: 'Python Programming',
    courseCode: 'PY101',
    description: 'Start coding in Python from fundamentals to packaging.',
    category: 'Programming',
    price: 'Free',
    duration: '4 weeks',
    totalHours: 20,
    level: 'Beginner',
    imageId: 'course-python',
    lessons: [
      { 
        title: 'Getting Started', 
        content: 'In this lesson you will install Python, run your first script, and learn basic syntax: variables, numbers, strings, and simple control flow (if/else, for, while). By the end, you will be able to write a small program that takes input and prints a result. Example:\n\nname = input(\'What is your name? \\n\')\nprint(f\'Hello, {name}!\')',
        title_ar: 'البدء',
        content_ar: 'في هذا الدرس ستقوم بتثبيت بايثون، وتشغيل أول برنامج لك، وتتعرف على أساسيات اللغة: المتغيرات، الأعداد، السلاسل النصية، وتراكيب التحكّم البسيطة (if/else, for, while). في النهاية ستتمكن من كتابة برنامج صغير يستقبل إدخالاً ويطبع نتيجة. مثال:\n\nname = input(\'ما اسمك؟ \\n\')\nprint(f\'مرحباً، {name}!\')'
      },
      { 
        title: 'Data Structures', 
        content: 'Explore lists, dictionaries, sets, and tuples. Practice indexing, slicing, comprehensions, and common methods (append, pop, keys). You\'ll build a small contact book using a list of dictionaries.',
        title_ar: 'هياكل البيانات',
        content_ar: 'تعرّف على القوائم والقواميس والمجموعات والصفوف. تدرّب على الفهرسة والتقطيع والتعبيرات المختصرة وأشهر الدوال (append, pop, keys). ستبني دفتر عناوين بسيط باستخدام قائمة من القواميس.'
      },
      { 
        title: 'Functions & Modules', 
        content: 'Define reusable functions, understand parameters and return values, and organize code with modules. You\'ll separate logic into a utils.py and import it from a main script.',
        title_ar: 'الدوال والوحدات',
        content_ar: 'تعلّم كيفية تعريف الدوال القابلة لإعادة الاستخدام، ومعرفة الوسائط وقيم الإرجاع، وتنظيم الشيفرة عبر الوحدات. ستفصل المنطق في ملف utils.py وتستورد منه في البرنامج الرئيسي.'
      },
      { 
        title: 'File I/O & Errors', 
        content: 'Read and write files safely using context managers (with ... as ...). Handle exceptions with try/except, and raise errors when needed.',
        title_ar: 'الملفات والأخطاء',
        content_ar: 'تعلّم القراءة والكتابة من الملفات بأمان باستخدام مديري السياق (with ... as ...). تعامل مع الاستثناءات باستخدام try/except، وكيفية إطلاق الأخطاء عند الحاجة.'
      },
      { 
        title: 'Environments & Packaging', 
        content: 'Create virtual environments (venv), manage dependencies with pip, and structure a small package. Learn how to add a requirements.txt and run your app.',
        title_ar: 'البيئات والحزم',
        content_ar: 'أنشئ بيئات افتراضية (venv)، وأدر التبعيات باستخدام pip، ونظّم مشروعك كحزمة صغيرة. تعلّم إضافة requirements.txt وتشغيل تطبيقك.'
      },
    ],
  },
  {
    title: 'Business Intelligence',
    courseCode: 'BI101',
    description: 'Turn raw data into insights with modeling and dashboards.',
    category: 'Data',
    price: '$129',
    duration: '5 weeks',
    totalHours: 15,
    level: 'Beginner',
    imageId: 'course-bi',
    lessons: [
      { title: 'BI Concepts', content: 'Dimensions, facts, star schemas, and data marts.', title_ar: 'مفاهيم ذكاء الأعمال', content_ar: 'الأبعاد، الوقائع، مخططات النجمة، ومخازن البيانات.' },
      { title: 'Data Modeling', content: 'Modeling principles for analytics.', title_ar: 'نمذجة البيانات', content_ar: 'مبادئ النمذجة التحليلية.' },
      { title: 'SQL for Analytics', content: 'Joins, aggregations, and windows.', title_ar: 'SQL للتحليلات', content_ar: 'عمليات الربط، التجميع، ودوال النوافذ.' },
      { title: 'Dashboards', content: 'Best practices for visual design and storytelling.', title_ar: 'لوحات المعلومات', content_ar: 'أفضل الممارسات للتصميم البصري وسرد القصص.' },
      { title: 'KPIs & Reporting', content: 'Defining metrics and automating reports.', title_ar: 'مؤشرات الأداء والتقارير', content_ar: 'تعريف المقاييس وأتمتة التقارير.' },
    ],
  },
  {
    title: 'Digital Skills for Work (Libya) — Essentials',
    courseCode: 'DS-WORK',
    description: 'Practical computer, cloud storage, and communication skills for office work in Libya.',
    category: 'Office & Productivity',
    price: 'Free',
    duration: '24 hours over 4 weeks',
    totalHours: 24,
    level: 'Beginner',
    imageId: 'course-digital-skills',
    lessons: [
      { title: 'Computer Basics & Setup', content: 'System settings, updates, and safe daily usage.' },
      { title: 'File Management & Cloud Storage', content: 'Organize files and collaborate via Google Drive/OneDrive.' },
      { title: 'Documents & Reports', content: 'Create and format professional documents.' },
      { title: 'Spreadsheets for Work', content: 'Data entry, formulas, and charts in Sheets/Calc.' },
      { title: 'Presentations that Communicate', content: 'Slide clarity, visuals, and delivery basics.' },
      { title: 'Email & Calendar', content: 'Professional email templates, CC/BCC, and scheduling.' },
      { title: 'Online Meetings', content: 'Google Meet/Jitsi basics, screen sharing, etiquette.' },
      { title: 'Web Research & Safety', content: 'Search strategies, password hygiene, avoiding scams.' },
      { title: 'Office Hardware Basics', content: 'Printers, scanners, and PDF workflows.' },
      { title: 'Mini Project', content: 'Deliver a document, spreadsheet, and slides in a shared folder.' },
    ],
  },
  {
    title: 'Business Communication (Arabic/English) for the Workplace',
    courseCode: 'BIZ-COMM',
    description: 'Clear bilingual (AR/EN) communication for email, meetings, and reports.',
    category: 'Communication',
    price: 'Free',
    duration: '18 hours over 3 weeks',
    totalHours: 18,
    level: 'Beginner',
    imageId: 'course-business-comm',
    lessons: [
      { title: 'Email & Chat Basics (AR/EN)', content: 'Tone, structure, and reusable templates.' },
      { title: 'Effective Meetings', content: 'Agendas, minutes, and action items.' },
      { title: 'Short Presentations', content: 'Storyline and simple slides for clarity.' },
      { title: 'Reporting Essentials', content: 'Status updates and incident notes.' },
      { title: 'Cross-Cultural Communication', content: 'Clear language and time-zone considerations.' },
      { title: 'Feedback & Difficult Conversations', content: 'Constructive feedback and role-play.' },
      { title: 'Tools Setup', content: 'Signatures, calendars, labels, and folders.' },
      { title: 'Practice Clinic', content: 'Review and improve real samples.' },
    ],
  },
  {
    title: 'Customer Service & Call Center Skills: From Zero to Job-Ready',
    courseCode: 'CS-CC',
    description: 'Call handling, ticketing, and KPI basics for call centers and service desks.',
    category: 'Customer Service',
    price: 'Free',
    duration: '20 hours over 3–4 weeks',
    totalHours: 20,
    level: 'Beginner',
    imageId: 'course-customer-service',
    lessons: [
      { title: 'Customer Service Foundations', content: 'Mindset, processes, and common KPIs.' },
      { title: 'Call Flow & Scripts', content: 'Greeting, probing, solution, and closing.' },
      { title: 'Ticketing Basics', content: 'Categories, priorities, and clear notes.' },
      { title: 'Multichannel Support', content: 'Phone, chat, and email best practices.' },
      { title: 'Escalation & Handover', content: 'Who, when, and how to escalate properly.' },
      { title: 'Difficult Calls', content: 'De-escalation techniques and empathy.' },
      { title: 'Quality & Compliance', content: 'Recording, privacy, and QA basics.' },
      { title: 'Practice Lab', content: 'Simulated calls and ticket entries.' },
    ],
  },
  {
    title: 'IT Support Technician (Helpdesk) — Practical Troubleshooting',
    courseCode: 'IT-HELP',
    description: 'Hands-on support skills for Windows, networks, printers, and user accounts.',
    category: 'IT Support',
    price: 'Free',
    duration: '30 hours over 5 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-it-support',
    lessons: [
      { title: 'Helpdesk Fundamentals', content: 'Roles, SLAs, and essential tools.' },
      { title: 'Windows Troubleshooting', content: 'Updates, drivers, performance, and logs.' },
      { title: 'Printing & Scanning', content: 'Drivers, queues, and PDF workflows.' },
      { title: 'Network Basics', content: 'IP, DHCP, Wi‑Fi, and router resets.' },
      { title: 'Accounts & Permissions', content: 'Local users and Google Workspace basics.' },
      { title: 'Security Hygiene', content: 'Patching, antivirus, and phishing awareness.' },
      { title: 'Backup & Restore', content: 'Cloud sync and external drives.' },
      { title: 'Documentation & Ticketing', content: 'Write notes others can use.' },
    ],
  },
  {
    title: 'Computer & Mobile Maintenance (Hands-On)',
    courseCode: 'CM-MAINT',
    description: 'Practical maintenance for PCs and Android devices common in Libya.',
    category: 'Hardware',
    price: 'Free',
    duration: '28 hours over 4–5 weeks',
    totalHours: 28,
    level: 'Beginner',
    imageId: 'course-computer-mobile-maint',
    lessons: [
      { title: 'Safety & Tools', content: 'ESD, toolkits, and checklists.' },
      { title: 'PC Tear-down & Cleaning', content: 'Fans, thermal paste, cable management.' },
      { title: 'Storage & RAM', content: 'Diagnosis and replacement.' },
      { title: 'Windows Reinstall', content: 'Drivers, updates, and user data migration.' },
      { title: 'Android Maintenance', content: 'Backup, reset, and app troubleshooting.' },
      { title: 'Malware & Performance', content: 'Scans, startup control, and cleanup.' },
      { title: 'Customer Service & Warranty', content: 'Expectations and records.' },
      { title: 'Workshop Day', content: 'Hands-on practice with sample devices.' },
    ],
  },
  {
    title: 'Networking Fundamentals (Beginner to CCNA-Ready Basics)',
    courseCode: 'NET-FND',
    description: 'Core networking skills for small offices, ISPs, and NGOs.',
    category: 'Networking',
    price: 'Free',
    duration: '30 hours over 5 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-networking',
    lessons: [
      { title: 'Networking Basics & OSI/TCP‑IP', content: 'Concepts, addressing, and protocols.' },
      { title: 'IPv4 Addressing & Subnetting', content: 'Plan and calculate subnets.' },
      { title: 'Switching & VLANs', content: 'Segmentation, trunking, and inter‑VLAN basics.' },
      { title: 'Routing & NAT', content: 'Static routes, defaults, and Internet access.' },
      { title: 'DHCP & DNS', content: 'Local services and troubleshooting.' },
      { title: 'Wireless Networking', content: 'Security, channels, and coverage.' },
      { title: 'Cabling & Hardware', content: 'Cables, tools, and device choices.' },
      { title: 'Troubleshooting with CLI/Wireshark', content: 'Common fault patterns and tools.' },
      { title: 'Small Office Design', content: 'Plan a 1‑router/1‑switch/1‑AP network.' },
      { title: 'Exam Prep & Lab Review', content: 'Practice tasks and documentation.' },
    ],
  },
  {
    title: 'Cybersecurity Fundamentals for Offices & Small Businesses',
    courseCode: 'CYBER-FND',
    description: 'Low-cost security controls to protect Libyan offices from common threats.',
    category: 'Security',
    price: 'Free',
    duration: '24 hours over 4 weeks',
    totalHours: 24,
    level: 'Beginner',
    imageId: 'course-security-fundamentals',
    lessons: [
      { title: 'Security Essentials', content: 'Threats, risk, and layered defense.' },
      { title: 'Identity & Access', content: 'Passwords, MFA, and least privilege.' },
      { title: 'Endpoint Security', content: 'Updates, AV, and device hygiene.' },
      { title: 'Network Security', content: 'Router setup, firewall rules, DNS filtering.' },
      { title: 'Data Protection', content: 'Backups, versioning, and sharing safely.' },
      { title: 'Email & Web Security', content: 'Phishing detection and safe browsing.' },
      { title: 'Incident Response', content: 'Triage steps, containment, reporting.' },
      { title: 'Policy & Awareness', content: 'Simple policies and short trainings.' },
    ],
  },
  {
    title: 'Linux Fundamentals for IT & Cloud',
    courseCode: 'LINUX-FND',
    description: 'Essential Linux skills for servers, cloud, and DevOps tooling.',
    category: 'Linux',
    price: 'Free',
    duration: '30 hours over 5 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-linux-fundamentals',
    lessons: [
      { title: 'Intro to Linux & Shell', content: 'CLI, files, permissions, and navigation.' },
      { title: 'Package Management', content: 'apt usage, updates, and repositories.' },
      { title: 'Users, Groups, SSH', content: 'Access control and remote admin.' },
      { title: 'Networking & Firewall', content: 'IP/DNS basics and UFW rules.' },
      { title: 'Services & Web Server', content: 'systemd and Nginx site setup.' },
      { title: 'Storage & Filesystems', content: 'Mounts, fstab, and disk usage.' },
      { title: 'Logs & Monitoring', content: 'journalctl and standard tools.' },
      { title: 'Bash Scripting', content: 'Variables, loops, and automation.' },
      { title: 'Backups & Cron', content: 'rsync/tar and scheduled tasks.' },
      { title: 'Hardening Basics', content: 'Updates and least privilege.' },
    ],
  },
  {
    title: 'Data Analyst Track 1: Excel Analytics for Real Work',
    courseCode: 'DA-EXCEL',
    description: 'Clean data, build pivot tables, and design clear dashboards for decisions.',
    category: 'Data',
    price: 'Free',
    duration: '24 hours over 4 weeks',
    totalHours: 24,
    level: 'Beginner',
    imageId: 'course-excel-analytics',
    lessons: [
      { title: 'Workbook Setup & Hygiene', content: 'Tables, ranges, and data types.' },
      { title: 'Cleaning & Validation', content: 'Remove duplicates and fix dates.' },
      { title: 'Core Formulas', content: 'LOOKUPs, IF, SUMIFS, and text/date functions.' },
      { title: 'Pivot Tables', content: 'Grouping, calculated fields, and slicers.' },
      { title: 'Pivot Charts & KPIs', content: 'Chart selection and formatting.' },
      { title: 'Dashboard Design', content: 'Layout, color, and clarity.' },
      { title: 'Mini Case', content: 'Sales/service dataset analysis.' },
      { title: 'Collaboration', content: 'Comments, protection, and sharing.' },
    ],
  },
  {
    title: 'Data Analyst Track 2: SQL for Data Analysis',
    courseCode: 'DA-SQL',
    description: 'Practical SQL to query, join, and summarize data for real business questions.',
    category: 'Data',
    price: 'Free',
    duration: '28 hours over 4–5 weeks',
    totalHours: 28,
    level: 'Beginner',
    imageId: 'course-sql-analysis',
    lessons: [
      { title: 'SQL Setup', content: 'PostgreSQL/SQLite, clients, and sample data.' },
      { title: 'Query Basics', content: 'SELECT, WHERE, ORDER BY, and LIMIT.' },
      { title: 'Joins', content: 'INNER/LEFT joins, anti-joins, and real cases.' },
      { title: 'Aggregations', content: 'GROUP BY, HAVING, and rollups.' },
      { title: 'Window Functions', content: 'Ranking and moving averages.' },
      { title: 'Subqueries & CTEs', content: 'Organize complex logic.' },
      { title: 'Data Cleaning in SQL', content: 'Types, NULLs, and text/dates.' },
      { title: 'Views & Scheduling', content: 'Reusable queries for reports.' },
      { title: 'Performance Basics', content: 'Indexes and EXPLAIN (intro).' },
      { title: 'Case Study', content: 'Answer stakeholder questions in SQL.' },
    ],
  },
  {
    title: 'Power BI Dashboard Builder: Reports That Decision-Makers Use',
    courseCode: 'PBI-DASH',
    description: 'Build practical dashboards with Power BI Desktop and free alternatives.',
    category: 'Data Visualization',
    price: 'Free',
    duration: '24 hours over 4 weeks',
    totalHours: 24,
    level: 'Beginner',
    imageId: 'course-powerbi',
    lessons: [
      { title: 'BI Mindset & Requirements', content: 'Focus reports on decisions, not data dumps.' },
      { title: 'Power Query', content: 'Clean and reshape data from CSV/Excel.' },
      { title: 'Data Modeling', content: 'Star schema and relationships.' },
      { title: 'DAX Fundamentals', content: 'Measures vs columns with common patterns.' },
      { title: 'Visuals & Layout', content: 'Chart selection, labels, and formatting.' },
      { title: 'Interactivity', content: 'Slicers, drillthrough, bookmarks, tooltips.' },
      { title: 'Sharing Options', content: 'PBIX, PDF, static exports, and alternatives.' },
      { title: 'Case Study', content: 'End-to-end dashboard for stakeholders.' },
    ],
  },
  {
    title: 'Python for Data Analysis (Beginner)',
    courseCode: 'PY-DATA',
    description: 'Use Python, pandas, and notebooks to clean, analyze, and visualize data.',
    category: 'Data',
    price: 'Free',
    duration: '30 hours over 5 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-python-data',
    lessons: [
      { title: 'Python Basics', content: 'Types, control flow, functions, and files.' },
      { title: 'Working in Notebooks', content: 'Jupyter cells and markdown for storytelling.' },
      { title: 'pandas Core', content: 'Indexing, cleaning, and transformation.' },
      { title: 'Grouping & Merging', content: 'Aggregations and joins for analysis.' },
      { title: 'Dates & Text', content: 'Parsing, extracting, and cleaning.' },
      { title: 'Visualization', content: 'matplotlib and seaborn basics.' },
      { title: 'Reproducibility', content: 'Virtual environments and scripts.' },
      { title: 'Mini-Case', content: 'Answer questions with charts and tables.' },
    ],
  },
  {
    title: 'Cloud Fundamentals (AWS/Azure/GCP) — The Practical Start',
    courseCode: 'CLOUD-FND',
    description: 'Vendor-neutral cloud basics with hands-on labs and cloud shells.',
    category: 'Cloud',
    price: 'Free',
    duration: '24 hours over 4 weeks',
    totalHours: 24,
    level: 'Beginner',
    imageId: 'course-cloud-fundamentals',
    lessons: [
      { title: 'Cloud Building Blocks', content: 'Compute, storage, network, and IAM.' },
      { title: 'Accounts & IAM', content: 'Users, roles, keys, and least privilege.' },
      { title: 'Compute 101', content: 'VM creation, SSH/RDP, and security groups.' },
      { title: 'Storage & CDN', content: 'Buckets, lifecycle, and static site hosting.' },
      { title: 'Networking Basics', content: 'VPC/VNet concept, subnets, and egress.' },
      { title: 'CLI & Cloud Shell', content: 'Hands-on with commands and scripts.' },
      { title: 'Security & Costs', content: 'Billing basics and hygiene.' },
      { title: 'Mini-Project', content: 'Host a static site in object storage.' },
    ],
  },
  {
    title: 'DevOps Fundamentals: Git, CI/CD & Containers',
    courseCode: 'DEVOPS-FND',
    description: 'Essential workflow with Git, Docker, and CI/CD to ship safely.',
    category: 'DevOps',
    price: 'Free',
    duration: '30 hours over 5 weeks',
    totalHours: 30,
    level: 'Beginner',
    imageId: 'course-devops-fundamentals',
    lessons: [
      { title: 'Git Essentials', content: 'Commits, branches, PRs, and reviews.' },
      { title: 'Docker 101', content: 'Images, containers, and multi-stage builds.' },
      { title: 'Compose for Dev', content: 'Local multi-service environments.' },
      { title: 'CI Basics', content: 'Pipelines, runners, caching, and artifacts.' },
      { title: 'Build/Test/Publish', content: 'Actions/GitLab CI to a registry.' },
      { title: 'Deploy to VM', content: 'Compose, env vars, and secrets basics.' },
      { title: 'Observability', content: 'Logs, healthchecks, and rollbacks.' },
      { title: 'Project Day', content: 'CI/CD on a small sample app.' },
    ],
  },
  {
    title: 'Agile & Scrum for Real Projects',
    courseCode: 'AGILE-SCR',
    description: 'Practical Scrum methods for offices, NGOs, and small software teams.',
    category: 'Agile',
    price: 'Free',
    duration: '16 hours over 2–3 weeks',
    totalHours: 16,
    level: 'Beginner',
    imageId: 'course-agile-scrum',
    lessons: [
      { title: 'Agile Mindset', content: 'Values, principles, and roles.' },
      { title: 'Product Backlog', content: 'User stories and acceptance criteria.' },
      { title: 'Estimation & Planning', content: 'Relative sizing and velocity basics.' },
      { title: 'Sprint Mechanics', content: 'Standups, review, and retro facilitation.' },
      { title: 'Boards & Metrics', content: 'Kanban vs Scrum, WIP, and burndown.' },
      { title: 'Cross‑functional Delivery', content: 'Handoffs and Definition of Done.' },
      { title: 'Adapting Agile', content: 'NGOs and business operations context.' },
      { title: 'Practical Simulation', content: 'Two mini sprints end to end.' },
    ],
  },
  {
    title: 'n8n Workflow Automation',
    courseCode: 'N8N-AUTO',
    description:
      'Build reliable automations with n8n: triggers, webhooks, APIs, data transformations, error handling, and deployment. Create AI-powered workflows and real integrations.',
    category: 'Automation',
    price: 'Free',
    duration: '20 hours over 4 weeks',
    totalHours: 20,
    level: 'Beginner',
    imageId: 'course-n8n',
    lessons: [
      {
        title: 'Welcome to n8n (What & Why)',
        content:
          'What n8n is, where it fits vs Zapier/Make, and how workflows, nodes, and executions work. Define your capstone automation for this course.',
      },
      {
        title: 'Setup: Cloud vs Self-Hosted',
        content:
          'Choose n8n Cloud or self-host with Docker. Configure basic settings, create a test workflow, and learn the editor UI (nodes, connections, executions).',
      },
      {
        title: 'Your First Workflow: Triggers & Actions',
        content:
          'Build a workflow with Manual and Schedule triggers, connect action nodes, run and debug. Learn how to inspect input/output data for each node.',
      },
      {
        title: 'Data & Expressions (JSON, Items, Mapping)',
        content:
          'Understand items, $json, and expressions like {{$json.field}}. Map fields between nodes, use Set/Merge, and avoid common mapping mistakes.',
      },
      {
        title: 'Webhooks in n8n',
        content:
          'Create a Webhook trigger, test with Postman/curl, parse query/body data, and return responses. Learn safe patterns for idempotency and signature checks.',
      },
      {
        title: 'HTTP Request Node & API Basics',
        content:
          'Call external APIs, handle headers, query params, pagination, and rate limits. Practice with a public API and store results in a spreadsheet or database.',
      },
      {
        title: 'Transforming Data: Built-in Nodes + Code',
        content:
          'Use SplitInBatches, IF, Switch, Date & Time, and the Code node (JavaScript) to clean and transform data. Build reusable sub-workflows.',
      },
      {
        title: 'Credentials & Security',
        content:
          'Manage credentials (API keys, OAuth2), environment variables, and secrets. Learn least-privilege access, safe logging, and protecting webhook endpoints.',
      },
      {
        title: 'Reliability: Errors, Retries, and Alerting',
        content:
          'Configure error workflows, Continue On Fail, retry/backoff, and notifications. Design workflows that are resilient and easy to support.',
      },
      {
        title: 'Deploying n8n for Production',
        content:
          'Docker Compose setup, database choice, encryption key, webhook base URL, reverse proxy, backups, and upgrade strategy. Basic scaling and monitoring.',
      },
      {
        title: 'AI Automations (LLMs) with n8n',
        content:
          'Use an LLM node to summarize, classify, and extract structured data. Add guardrails, control cost, and handle sensitive data safely.',
      },
      {
        title: 'Capstone: End-to-End Business Automation',
        content:
          'Build a complete automation: intake via webhook/form, validate & dedupe, enrich with AI, write to Sheets/CRM, notify via email/chat, and implement error handling.',
      },
    ],
  },
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    let decoded: any;
    try {
      decoded = await getAuth(app).verifyIdToken(token);
    } catch (e) {
      // Dev-only fallback to decode token payload for uid if verification fails locally
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = token.split('.');
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          decoded = payload; // contains 'sub' as uid
        } catch (e2) {
          throw e;
        }
      } else {
        throw e;
      }
    }

    const uid = decoded.uid || decoded.sub;
    const db = getFirestore(app);

    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const only = url.searchParams.get('only');
    const limit = limitParam ? Math.max(1, Math.min(seedCourses.length, parseInt(limitParam))) : seedCourses.length;

    // Authorize: require admin role from ID token custom claims only
    const roleFromToken = decoded?.role || decoded?.claims?.role;
    const isAdmin = roleFromToken === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results: string[] = [];
    const coursesToProcess = (only
      ? seedCourses.filter((c) => slugify(c.title) === only || c.title === only)
      : seedCourses).slice(0, limit);

    for (const course of coursesToProcess) {
      const slug = slugify(course.title);
      const courseRef = db.doc(`courses/${slug}`);
      const batch = db.batch();
      const courseCode =
        typeof course.courseCode === 'string' && course.courseCode.trim()
          ? course.courseCode.trim().toUpperCase().replace(/\s+/g, '')
          : undefined;
      const totalHours =
        typeof course.totalHours === 'number' && Number.isFinite(course.totalHours) && course.totalHours > 0
          ? Math.round(course.totalHours)
          : undefined;
      batch.set(
        courseRef,
        {
          id: slug,
          slug,
          status: 'PUBLISHED',
          ...(courseCode ? { courseCode } : {}),
          title: course.title,
          description: course.description,
          category: course.category,
          price: course.price,
          duration: course.duration,
          ...(typeof totalHours === 'number' ? { totalHours } : {}),
          level: course.level,
          imageId: course.imageId,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const base = Date.now();
      let i = 0;
      for (const l of course.lessons) {
        const lid = slugify(l.title);
        const lesRef = db.doc(`courses/${slug}/lessons/${lid}`);
        batch.set(
          lesRef,
          {
            id: lid,
            title: l.title,
            content: l.content,
            title_ar: (l as any).title_ar || null,
            content_ar: (l as any).content_ar || null,
            embedUrl: l.embedUrl || null,
            order: i,
            createdAt: Timestamp.fromMillis(base + i * 1000),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        i += 1;
      }
      await batch.commit();
      results.push(slug);
    }

    return NextResponse.json({ ok: true, seeded: results.length, courses: results }, { status: 200 });
  } catch (e: any) {
    console.error('seed-courses error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
