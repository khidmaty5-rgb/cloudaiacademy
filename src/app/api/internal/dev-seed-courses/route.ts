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
  description: string;
  category: string;
  price: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  imageId: string;
  lessons: Array<{ title: string; content: string; title_ar?: string; content_ar?: string; embedUrl?: string }>; 
}> = [
  {
    title: 'AWS Solutions Architect',
    description: 'Design and deploy secure, scalable systems on AWS.',
    category: 'Cloud',
    price: '$199',
    duration: '8 weeks',
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
    description: 'Build, train, deploy, and monitor ML systems end to end.',
    category: 'AI/ML',
    price: '$249',
    duration: '10 weeks',
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
    description: 'Leverage Azure AI services for CV, NLP, and search workloads.',
    category: 'Cloud/AI',
    price: '$229',
    duration: '8 weeks',
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
    description: 'Build modern web apps with Node, React, and SQL.',
    category: 'Web Dev',
    price: '$149',
    duration: '6 weeks',
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
    description: 'Start coding in Python from fundamentals to packaging.',
    category: 'Programming',
    price: 'Free',
    duration: '4 weeks',
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
    description: 'Turn raw data into insights with modeling and dashboards.',
    category: 'Data',
    price: '$129',
    duration: '5 weeks',
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
];

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
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
      const isDev = process.env.NODE_ENV !== 'production';
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
    const uid = decoded.uid || decoded.sub;
    const userDoc = await db.doc(`users/${uid}`).get();
    const roleFromDoc = userDoc.exists ? (userDoc.data() as any).role : undefined;
    const roleFromToken = decoded?.role || decoded?.claims?.role;
    const isAdmin = roleFromDoc === 'admin' || roleFromToken === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results: string[] = [];
    for (const course of seedCourses) {
      const slug = slugify(course.title);
      const courseRef = db.doc(`courses/${slug}`);
      const batch = db.batch();
      batch.set(
        courseRef,
        {
          id: slug,
          slug,
          title: course.title,
          description: course.description,
          category: course.category,
          price: course.price,
          duration: course.duration,
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
