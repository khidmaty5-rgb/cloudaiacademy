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
  const privateKey = rawKey ? rawKey.replace(/\n/g, '\n') : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }

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

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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
      { title: 'Web Fundamentals', content: 'HTTP, HTML/CSS/JS, and the clientâ€“server model.' },
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
        title_ar: 'Ø§Ù„Ø¨Ø¯Ø¡',
        content_ar: 'ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ø¯Ø±Ø³ Ø³ØªÙ‚ÙˆÙ… Ø¨ØªØ«Ø¨ÙŠØª Ø¨Ø§ÙŠØ«ÙˆÙ†ØŒ ÙˆØªØ´ØºÙŠÙ„ Ø£ÙˆÙ„ Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù„ÙƒØŒ ÙˆØªØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø£Ø³Ø§Ø³ÙŠØ§Øª Ø§Ù„Ù„ØºØ©: Ø§Ù„Ù…ØªØºÙŠØ±Ø§ØªØŒ Ø§Ù„Ø£Ø¹Ø¯Ø§Ø¯ØŒ Ø§Ù„Ø³Ù„Ø§Ø³Ù„ Ø§Ù„Ù†ØµÙŠØ©ØŒ ÙˆØªØ±Ø§ÙƒÙŠØ¨ Ø§Ù„ØªØ­ÙƒÙ‘Ù… Ø§Ù„Ø¨Ø³ÙŠØ·Ø© (if/else, for, while). ÙÙŠ Ø§Ù„Ù†Ù‡Ø§ÙŠØ© Ø³ØªØªÙ…ÙƒÙ† Ù…Ù† ÙƒØªØ§Ø¨Ø© Ø¨Ø±Ù†Ø§Ù…Ø¬ ØµØºÙŠØ± ÙŠØ³ØªÙ‚Ø¨Ù„ Ø¥Ø¯Ø®Ø§Ù„Ø§Ù‹ ÙˆÙŠØ·Ø¨Ø¹ Ù†ØªÙŠØ¬Ø©. Ù…Ø«Ø§Ù„:\n\nname = input(\'Ù…Ø§ Ø§Ø³Ù…ÙƒØŸ \\n\')\nprint(f\'Ù…Ø±Ø­Ø¨Ø§Ù‹ØŒ {name}!\')'
      },
      { 
        title: 'Data Structures', 
        content: 'Explore lists, dictionaries, sets, and tuples. Practice indexing, slicing, comprehensions, and common methods (append, pop, keys). You\'ll build a small contact book using a list of dictionaries.',
        title_ar: 'Ù‡ÙŠØ§ÙƒÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª',
        content_ar: 'ØªØ¹Ø±Ù‘Ù Ø¹Ù„Ù‰ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… ÙˆØ§Ù„Ù‚ÙˆØ§Ù…ÙŠØ³ ÙˆØ§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø§Øª ÙˆØ§Ù„ØµÙÙˆÙ. ØªØ¯Ø±Ù‘Ø¨ Ø¹Ù„Ù‰ Ø§Ù„ÙÙ‡Ø±Ø³Ø© ÙˆØ§Ù„ØªÙ‚Ø·ÙŠØ¹ ÙˆØ§Ù„ØªØ¹Ø¨ÙŠØ±Ø§Øª Ø§Ù„Ù…Ø®ØªØµØ±Ø© ÙˆØ£Ø´Ù‡Ø± Ø§Ù„Ø¯ÙˆØ§Ù„ (append, pop, keys). Ø³ØªØ¨Ù†ÙŠ Ø¯ÙØªØ± Ø¹Ù†Ø§ÙˆÙŠÙ† Ø¨Ø³ÙŠØ· Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù‚Ø§Ø¦Ù…Ø© Ù…Ù† Ø§Ù„Ù‚ÙˆØ§Ù…ÙŠØ³.'
      },
      { 
        title: 'Functions & Modules', 
        content: 'Define reusable functions, understand parameters and return values, and organize code with modules. You\'ll separate logic into a utils.py and import it from a main script.',
        title_ar: 'Ø§Ù„Ø¯ÙˆØ§Ù„ ÙˆØ§Ù„ÙˆØ­Ø¯Ø§Øª',
        content_ar: 'ØªØ¹Ù„Ù‘Ù… ÙƒÙŠÙÙŠØ© ØªØ¹Ø±ÙŠÙ Ø§Ù„Ø¯ÙˆØ§Ù„ Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…ØŒ ÙˆÙ…Ø¹Ø±ÙØ© Ø§Ù„ÙˆØ³Ø§Ø¦Ø· ÙˆÙ‚ÙŠÙ… Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ØŒ ÙˆØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ø´ÙŠÙØ±Ø© Ø¹Ø¨Ø± Ø§Ù„ÙˆØ­Ø¯Ø§Øª. Ø³ØªÙØµÙ„ Ø§Ù„Ù…Ù†Ø·Ù‚ ÙÙŠ Ù…Ù„Ù utils.py ÙˆØªØ³ØªÙˆØ±Ø¯ Ù…Ù†Ù‡ ÙÙŠ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ.'
      },
      { 
        title: 'File I/O & Errors', 
        content: 'Read and write files safely using context managers (with ... as ...). Handle exceptions with try/except, and raise errors when needed.',
        title_ar: 'Ø§Ù„Ù…Ù„ÙØ§Øª ÙˆØ§Ù„Ø£Ø®Ø·Ø§Ø¡',
        content_ar: 'ØªØ¹Ù„Ù‘Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© ÙˆØ§Ù„ÙƒØªØ§Ø¨Ø© Ù…Ù† Ø§Ù„Ù…Ù„ÙØ§Øª Ø¨Ø£Ù…Ø§Ù† Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ø¯ÙŠØ±ÙŠ Ø§Ù„Ø³ÙŠØ§Ù‚ (with ... as ...). ØªØ¹Ø§Ù…Ù„ Ù…Ø¹ Ø§Ù„Ø§Ø³ØªØ«Ù†Ø§Ø¡Ø§Øª Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… try/exceptØŒ ÙˆÙƒÙŠÙÙŠØ© Ø¥Ø·Ù„Ø§Ù‚ Ø§Ù„Ø£Ø®Ø·Ø§Ø¡ Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø©.'
      },
      { 
        title: 'Environments & Packaging', 
        content: 'Create virtual environments (venv), manage dependencies with pip, and structure a small package. Learn how to add a requirements.txt and run your app.',
        title_ar: 'Ø§Ù„Ø¨ÙŠØ¦Ø§Øª ÙˆØ§Ù„Ø­Ø²Ù…',
        content_ar: 'Ø£Ù†Ø´Ø¦ Ø¨ÙŠØ¦Ø§Øª Ø§ÙØªØ±Ø§Ø¶ÙŠØ© (venv)ØŒ ÙˆØ£Ø¯Ø± Ø§Ù„ØªØ¨Ø¹ÙŠØ§Øª Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… pipØŒ ÙˆÙ†Ø¸Ù‘Ù… Ù…Ø´Ø±ÙˆØ¹Ùƒ ÙƒØ­Ø²Ù…Ø© ØµØºÙŠØ±Ø©. ØªØ¹Ù„Ù‘Ù… Ø¥Ø¶Ø§ÙØ© requirements.txt ÙˆØªØ´ØºÙŠÙ„ ØªØ·Ø¨ÙŠÙ‚Ùƒ.'
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
      { title: 'BI Concepts', content: 'Dimensions, facts, star schemas, and data marts.', title_ar: 'Ù…ÙØ§Ù‡ÙŠÙ… Ø°ÙƒØ§Ø¡ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„', content_ar: 'Ø§Ù„Ø£Ø¨Ø¹Ø§Ø¯ØŒ Ø§Ù„ÙˆÙ‚Ø§Ø¦Ø¹ØŒ Ù…Ø®Ø·Ø·Ø§Øª Ø§Ù„Ù†Ø¬Ù…Ø©ØŒ ÙˆÙ…Ø®Ø§Ø²Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.' },
      { title: 'Data Modeling', content: 'Modeling principles for analytics.', title_ar: 'Ù†Ù…Ø°Ø¬Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª', content_ar: 'Ù…Ø¨Ø§Ø¯Ø¦ Ø§Ù„Ù†Ù…Ø°Ø¬Ø© Ø§Ù„ØªØ­Ù„ÙŠÙ„ÙŠØ©.' },
      { title: 'SQL for Analytics', content: 'Joins, aggregations, and windows.', title_ar: 'SQL Ù„Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª', content_ar: 'Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ø±Ø¨Ø·ØŒ Ø§Ù„ØªØ¬Ù…ÙŠØ¹ØŒ ÙˆØ¯ÙˆØ§Ù„ Ø§Ù„Ù†ÙˆØ§ÙØ°.' },
      { title: 'Dashboards', content: 'Best practices for visual design and storytelling.', title_ar: 'Ù„ÙˆØ­Ø§Øª Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª', content_ar: 'Ø£ÙØ¶Ù„ Ø§Ù„Ù…Ù…Ø§Ø±Ø³Ø§Øª Ù„Ù„ØªØµÙ…ÙŠÙ… Ø§Ù„Ø¨ØµØ±ÙŠ ÙˆØ³Ø±Ø¯ Ø§Ù„Ù‚ØµØµ.' },
      { title: 'KPIs & Reporting', content: 'Defining metrics and automating reports.', title_ar: 'Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø£Ø¯Ø§Ø¡ ÙˆØ§Ù„ØªÙ‚Ø§Ø±ÙŠØ±', content_ar: 'ØªØ¹Ø±ÙŠÙ Ø§Ù„Ù…Ù‚Ø§ÙŠÙŠØ³ ÙˆØ£ØªÙ…ØªØ© Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±.' },
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
    if ((process.env.NODE_ENV as string) === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    let decoded: any;
    try {
      decoded = await getAuth(app).verifyIdToken(token);
    } catch (e) {
      const isDev = (process.env.NODE_ENV as string) !== 'production';
      // Dev-only fallback to decode token payload locally if verification fails
      if (isDev) {
        try {
          const parts = token.split('.');
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          decoded = payload;
        } catch (e2) { throw e; }
      } else { throw e; }
    }

    const db = getFirestore(app);
    const roleFromToken = decoded?.role || decoded?.claims?.role;
    const isAdmin = roleFromToken === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results: string[] = [];
    for (const course of seedCourses) {
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
    console.error('dev-seed-courses error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

