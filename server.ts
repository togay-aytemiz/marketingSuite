import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';

import {
  extractColorPalette,
  generateBlogImage,
  generateFinalVisual,
} from './src/server/gemini';
import { getIntegrationStatus, loadLocalEnv } from './src/server/env';
import {
  addInternalLinks,
  analyzeSeoForBlog,
  editBlogPost,
  enhanceProductDetails,
  generateBlogPost,
  generateCopyIdeas,
  generateMarketingCopy,
  generateSocialPosts,
  generateTopicIdeas,
} from './src/server/openai';
import { fetchEditorialPlanningSnapshot } from './src/server/editorial-planner';
import { fetchSanityCategories, fetchSanityPosts, publishToSanity, syncEditorialCategories } from './src/server/sanity';
import { getStrategyContextSnapshot } from './src/server/strategy-context';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

loadLocalEnv();

function getQualyProjectPath() {
  const explicitPath = String(process.env.QUALY_LP_PATH || '').trim();
  const fallbackPath = path.resolve(process.cwd(), '../Qualy-lp');
  const candidatePaths = [explicitPath, fallbackPath].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return null;
}

async function refreshQualyBlogArtifacts() {
  const projectPath = getQualyProjectPath();
  if (!projectPath) {
    return {
      attempted: false,
      succeeded: false,
      projectPath: null,
      message: 'Qualy blog project path is not configured.',
    };
  }

  try {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await execFileAsync(npmCommand, ['--prefix', projectPath, 'run', 'blog:generate'], {
      cwd: projectPath,
      env: process.env,
    });

    return {
      attempted: true,
      succeeded: true,
      projectPath,
      message: 'Qualy blog artifacts refreshed.',
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      projectPath,
      message: error instanceof Error ? error.message : 'Qualy blog refresh failed.',
    };
  }
}

function getStatusPayload() {
  const baseStatus = getIntegrationStatus();
  const qualyProjectPath = getQualyProjectPath();

  return {
    ...baseStatus,
    qualy: {
      configured: Boolean(qualyProjectPath),
      projectPath: qualyProjectPath,
    },
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '50mb' }));

  app.get('/api/integrations/status', (_req, res) => {
    res.json(getStatusPayload());
  });

  app.get('/api/strategy/context', (_req, res) => {
    res.json(getStrategyContextSnapshot());
  });

  app.get('/api/sanity/categories', async (req, res) => {
    try {
      const preferredLanguage = req.query.language === 'en' ? 'en' : 'tr';
      const categories = await fetchSanityCategories(preferredLanguage);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch Sanity categories.' });
    }
  });

  app.get('/api/sanity/posts', async (_req, res) => {
    try {
      const posts = await fetchSanityPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch Sanity posts.' });
    }
  });

  app.post('/api/sanity/categories/sync', async (_req, res) => {
    try {
      const result = await syncEditorialCategories();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to sync Sanity categories.' });
    }
  });

  app.post('/api/sanity/publish', async (req, res) => {
    try {
      const publishResult = await publishToSanity(req.body);
      const siteRefresh = await refreshQualyBlogArtifacts();

      res.json({
        ...publishResult,
        siteRefresh,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish to Sanity.' });
    }
  });

  app.post('/api/ai/:action', async (req, res) => {
    const action = String(req.params.action || '');
    const status = getIntegrationStatus();

    const geminiOnlyActions = new Set([
      'extract-color-palette',
      'generate-final-visual',
      'generate-blog-image',
    ]);

    const openAiOnlyActions = new Set([
      'enhance-product-details',
      'generate-marketing-copy',
      'generate-copy-ideas',
      'generate-topic-ideas',
      'analyze-seo-for-blog',
      'generate-blog-post',
      'add-internal-links',
      'edit-blog-post',
      'generate-social-posts',
    ]);

    if (geminiOnlyActions.has(action) && !status.gemini.configured) {
      return res.status(503).json({
        error: 'Gemini is not configured. Add GEMINI_API_KEY to .env.local before using AI actions.',
        missing: status.gemini.missing,
      });
    }

    if (openAiOnlyActions.has(action) && !status.openai.configured) {
      return res.status(503).json({
        error: 'OpenAI is not configured. Add OPENAI_API_KEY to .env.local before using AI text actions.',
        missing: status.openai.missing,
      });
    }

    try {
      let result: unknown;
      const needsEditorialPlanning = status.sanity.configured && (
        action === 'generate-topic-ideas' || action === 'generate-blog-post'
      );
      let editorialSnapshot: Awaited<ReturnType<typeof fetchEditorialPlanningSnapshot>> | null = null;
      if (needsEditorialPlanning) {
        try {
          editorialSnapshot = await fetchEditorialPlanningSnapshot(req.body.language);
        } catch (planningError) {
          console.warn('Editorial planning snapshot fetch failed, falling back to request payload.', planningError);
        }
      }

      switch (action) {
        case 'enhance-product-details':
          result = await enhanceProductDetails(
            req.body.productName,
            req.body.featureName,
            req.body.targetAudience,
            req.body.description
          );
          break;
        case 'generate-marketing-copy':
          result = await generateMarketingCopy(
            req.body.productName,
            req.body.featureName,
            req.body.description,
            req.body.campaignType,
            req.body.tone,
            req.body.language
          );
          break;
        case 'generate-copy-ideas':
          result = await generateCopyIdeas(
            req.body.productName,
            req.body.featureName,
            req.body.description,
            req.body.campaignType,
            req.body.tone,
            req.body.language
          );
          break;
        case 'extract-color-palette':
          result = await extractColorPalette(req.body.imageBase64);
          break;
        case 'generate-final-visual':
          result = await generateFinalVisual(
            req.body.images || [],
            req.body.productName,
            req.body.featureName,
            req.body.description,
            req.body.headline,
            req.body.subheadline,
            req.body.cta,
            req.body.brandColor,
            req.body.campaignType,
            req.body.aspectRatio,
            req.body.tone,
            req.body.designStyle,
            req.body.mode,
            req.body.language,
            req.body.customInstruction,
            req.body.campaignFocus,
            req.body.variationIndex,
            req.body.previousImage,
            req.body.userComment,
            req.body.referenceImage
          );
          break;
        case 'generate-topic-ideas':
          result = await generateTopicIdeas(
            req.body.productName,
            req.body.featureName,
            req.body.targetAudience,
            req.body.description,
            req.body.language,
            req.body.existingTopics || [],
            editorialSnapshot?.recentPosts || req.body.recentPosts || [],
            editorialSnapshot?.recentPostTitles || req.body.recentPostTitles || [],
            editorialSnapshot?.sanityCategories || req.body.sanityCategories || []
          );
          break;
        case 'analyze-seo-for-blog':
          result = await analyzeSeoForBlog(
            req.body.title,
            req.body.description,
            req.body.content,
            req.body.keywords
          );
          break;
        case 'generate-blog-post':
          result = await generateBlogPost(
            req.body.productName,
            req.body.featureName,
            req.body.targetAudience,
            req.body.description,
            req.body.topic,
            req.body.keywords,
            req.body.tone,
            req.body.length,
            req.body.language,
            req.body.imageStyle,
            editorialSnapshot?.recentPosts || req.body.sanityPosts || [],
            editorialSnapshot?.sanityCategories || req.body.sanityCategories || []
          );
          break;
        case 'generate-blog-image':
          result = await generateBlogImage(req.body.prompt, Boolean(req.body.isCover));
          break;
        case 'add-internal-links':
          result = await addInternalLinks(
            req.body.currentContent,
            req.body.sanityPosts || [],
            req.body.language,
            req.body.productName,
            req.body.featureName
          );
          break;
        case 'edit-blog-post':
          result = await editBlogPost(
            req.body.currentContent,
            req.body.instruction,
            req.body.productName,
            req.body.featureName,
            req.body.targetAudience,
            req.body.description,
            req.body.language,
            req.body.sanityPosts
          );
          break;
        case 'generate-social-posts':
          result = await generateSocialPosts(req.body.blogContent, req.body.language);
          break;
        default:
          return res.status(404).json({ error: `Unknown AI action: ${action}` });
      }

      if (result === null || typeof result === 'undefined') {
        return res.status(502).json({ error: `AI action failed: ${action}` });
      }

      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'AI action failed.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
