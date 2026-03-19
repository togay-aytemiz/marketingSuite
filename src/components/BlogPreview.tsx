import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { Settings, PenTool, Loader2, Copy, Check, BarChart3, AlertCircle, Image as ImageIcon, Sparkles, Wand2, Send, Download, RefreshCw, Link as LinkIcon, UploadCloud, Edit3, Eye, Share2, Twitter, Linkedin, Database } from 'lucide-react';
import { generateBlogPost, analyzeSeoForBlog, generateBlogImage, editBlogPost, addInternalLinks, generateSocialPosts } from '../services/gemini';
import { fetchSanityPosts, fetchSanityCategories, publishToSanity } from '../services/sanity';
import type { IntegrationStatus } from '../services/integrations';
import Markdown from 'react-markdown';

interface BlogPreviewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  triggerGenerate: number;
  integrationStatus: IntegrationStatus;
}

export const BlogPreview: React.FC<BlogPreviewProps> = ({ state, setState, isGenerating, setIsGenerating, triggerGenerate, integrationStatus }) => {
  const [isAnalyzingSeo, setIsAnalyzingSeo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blogImages, setBlogImages] = useState<Record<string, { loading: boolean, url: string | null }>>({});
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isManualEditMode, setIsManualEditMode] = useState(false);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [socialPosts, setSocialPosts] = useState<{ twitter: string; linkedin: string } | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [viewLanguage, setViewLanguage] = useState<'TR' | 'EN'>('TR');
  const [sanityMessage, setSanityMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const geminiConfigured = integrationStatus.gemini.configured;
  const sanityConfigured = integrationStatus.sanity.configured;

  useEffect(() => {
    if (triggerGenerate > 0) {
      handleGenerate();
    }
  }, [triggerGenerate]);

  const handleGenerateCover = async () => {
    const prompt = viewLanguage === 'EN' ? state.blogCoverPromptEN : state.blogCoverPrompt;
    if (!prompt) return;
    setIsGeneratingCover(true);
    const url = await generateBlogImage(prompt, true);
    if (url) {
      setState(prev => ({
        ...prev,
        ...(viewLanguage === 'EN' ? { blogCoverUrlEN: url } : { blogCoverUrl: url })
      }));
    }
    setIsGeneratingCover(false);
  };

  const handleGenerateImage = async (prompt: string) => {
    setBlogImages(prev => ({ ...prev, [prompt]: { loading: true, url: null } }));
    const imageUrl = await generateBlogImage(prompt);
    setBlogImages(prev => ({ ...prev, [prompt]: { loading: false, url: imageUrl } }));
  };

  const handleGenerate = async () => {
    if (!geminiConfigured) {
      setSanityMessage({ type: 'error', text: 'AI kapali. GEMINI_API_KEY ekledikten sonra blog uretebilirsin.' });
      return;
    }

    setIsGenerating(true);
    setState(prev => ({ ...prev, blogContent: null, blogContentEN: null, seoAnalysis: null, seoAnalysisEN: null }));
    
    let sanityPostsToPass: { title: string; slug: string }[] | undefined = undefined;
    let sanityCategoriesToPass: { id: string; name: string }[] | undefined = undefined;

    try {
      if (state.autoInternalLinks) {
        const posts = await fetchSanityPosts();
        sanityPostsToPass = posts.map(p => ({ title: p.title, slug: p.slug.current }));
      }
      const categories = await fetchSanityCategories(state.language === 'EN' ? 'en' : 'tr');
      sanityCategoriesToPass = categories.map(c => ({ id: c._id, name: c.title }));
    } catch (e) {
      console.error("Error fetching Sanity data:", e);
    }

    const response = await generateBlogPost(
      state.productName,
      state.featureName,
      state.targetAudience,
      state.description,
      state.blogTopic,
      state.blogKeywords,
      state.blogTone,
      state.blogLength,
      state.language,
      state.blogImageStyle,
      sanityPostsToPass,
      sanityCategoriesToPass
    );
    
    if (response) {
      const selectedCategory = sanityCategoriesToPass?.find(c => c.id === response.categoryId) || null;
      
      setViewLanguage(state.language === 'EN' ? 'EN' : 'TR');

      setState(prev => ({ 
        ...prev, 
        blogContent: response.content,
        blogTitle: response.title,
        blogDescription: response.description,
        blogSlug: response.slug,
        blogCoverPrompt: response.coverImagePrompt,
        blogCoverAltText: response.coverAltText,
        blogCategory: selectedCategory,
        blogCoverUrl: null, // Reset cover image on new generation
        blogContentEN: response.contentEN || null,
        blogTitleEN: response.titleEN || null,
        blogDescriptionEN: response.descriptionEN || null,
        blogSlugEN: response.slugEN || null,
        blogCoverPromptEN: response.coverImagePromptEN || null,
        blogCoverAltTextEN: response.coverAltTextEN || null,
        blogCoverUrlEN: null
      }));
      setSocialPosts(null);
      
      // Run SEO Analysis
      setIsAnalyzingSeo(true);
      const analysis = await analyzeSeoForBlog(response.title, response.description, response.content, state.blogKeywords);
      if (analysis) {
        setState(prev => ({ ...prev, seoAnalysis: analysis }));
      }
      
      if (response.contentEN) {
        const analysisEN = await analyzeSeoForBlog(response.titleEN || '', response.descriptionEN || '', response.contentEN, state.blogKeywords);
        if (analysisEN) {
          setState(prev => ({ ...prev, seoAnalysisEN: analysisEN }));
        }
      }
      setIsAnalyzingSeo(false);
    }
    setIsGenerating(false);
  };

  const handleCopy = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (currentContent) {
      navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (currentContent) {
      const blob = new Blob([currentContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = viewLanguage === 'EN' ? state.blogTitleEN : state.blogTitle;
      const topic = state.blogTopic || 'blog-post';
      const fileName = title ? title.replace(/[^a-z0-9]/gi, '-').toLowerCase() : topic.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      a.download = `${fileName}-${viewLanguage.toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleGenerateSocial = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent || !geminiConfigured) return;
    setIsGeneratingSocial(true);
    const posts = await generateSocialPosts(currentContent, viewLanguage);
    if (posts) {
      setSocialPosts(posts);
    }
    setIsGeneratingSocial(false);
  };

  const handleEdit = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!editInstruction.trim() || !currentContent || !geminiConfigured) return;
    setIsEditing(true);

    let sanityPostsToPass: { title: string; slug: string }[] | undefined = undefined;
    if (state.autoInternalLinks) {
      try {
        const posts = await fetchSanityPosts();
        sanityPostsToPass = posts.map(p => ({ title: p.title, slug: p.slug.current }));
      } catch (e) {
        console.error("Error fetching Sanity posts for internal links during edit:", e);
      }
    }

    const updatedContent = await editBlogPost(
      currentContent,
      editInstruction,
      state.productName,
      state.featureName,
      state.targetAudience,
      state.description,
      viewLanguage, // Pass the specific language being edited
      sanityPostsToPass
    );

    if (updatedContent) {
      setState(prev => ({
        ...prev,
        ...(viewLanguage === 'EN' ? { blogContentEN: updatedContent } : { blogContent: updatedContent })
      }));
      setEditInstruction('');
      
      // Re-run SEO Analysis
      setIsAnalyzingSeo(true);
      const analysis = await analyzeSeoForBlog(
        viewLanguage === 'EN' ? state.blogTitleEN || '' : state.blogTitle || '',
        viewLanguage === 'EN' ? state.blogDescriptionEN || '' : state.blogDescription || '',
        updatedContent, 
        state.blogKeywords
      );
      if (analysis) {
        setState(prev => ({
          ...prev,
          ...(viewLanguage === 'EN' ? { seoAnalysisEN: analysis } : { seoAnalysis: analysis })
        }));
      }
      setIsAnalyzingSeo(false);
    }
    setIsEditing(false);
  };

  const handlePublishToSanity = async () => {
    if (!state.blogContent) return;
    if (!sanityConfigured) {
      setSanityMessage({ type: 'error', text: 'Sanity bagli degil. .env.local icine SANITY_PROJECT_ID ve SANITY_TOKEN ekle.' });
      return;
    }

    setIsPublishing(true);
    setSanityMessage(null);
    
    // Extract title from H1 or use topic
    const titleMatch = state.blogContent.match(/^#\s+(.*)/m);
    const title = state.blogTitle || (titleMatch ? titleMatch[1] : state.blogTopic || 'Untitled Blog Post');

    const translationKey = `writer-${Date.now()}`;

    const trData = {
      title,
      content: state.blogContent,
      description: state.blogDescription || '',
      slug: state.blogSlug || undefined,
      coverAltText: state.blogCoverAltText || undefined,
    };

    let enData = undefined;
    if (state.blogContentEN) {
      const titleMatchEN = state.blogContentEN.match(/^#\s+(.*)/m);
      const titleEN = state.blogTitleEN || (titleMatchEN ? titleMatchEN[1] : state.blogTopic || 'Untitled Blog Post');
      enData = {
        title: titleEN,
        content: state.blogContentEN,
        description: state.blogDescriptionEN || '',
        slug: state.blogSlugEN || undefined,
        coverAltText: state.blogCoverAltTextEN || undefined,
      };
    }

    const result = await publishToSanity({
      translationKey,
      categoryId: state.blogCategory?.id ? String(state.blogCategory.id) : null,
      tr: trData,
      en: enData
    });
    
    if (result?.success) {
      const refreshNote = result.siteRefresh?.attempted
        ? result.siteRefresh.succeeded
          ? ' Qualy blog dosyalari da yenilendi.'
          : ` Sanity publish oldu ama local blog refresh basarisiz: ${result.siteRefresh.message}`
        : '';
      setSanityMessage({ type: 'success', text: `Sanity'e gonderildi.${refreshNote}` });
    } else {
      setSanityMessage({ type: 'error', text: 'Sanity publish basarisiz.' });
    }
    setIsPublishing(false);
    setTimeout(() => setSanityMessage(null), 3000);
  };

  const handleAddInternalLinks = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent) return;
    if (!sanityConfigured) {
      setSanityMessage({ type: 'error', text: 'Sanity bagli degil. Internal link eklemek icin once Sanity ayarlarini tamamla.' });
      return;
    }

    setIsLinking(true);
    setSanityMessage(null);

    const posts = await fetchSanityPosts();
    
    if (posts.length === 0) {
      setSanityMessage({ type: 'error', text: 'No posts found in Sanity to link to.' });
      setIsLinking(false);
      setTimeout(() => setSanityMessage(null), 3000);
      return;
    }

    const updatedContent = await addInternalLinks(currentContent, posts.map(p => ({ title: p.title, slug: p.slug.current })), viewLanguage);
    
    if (updatedContent) {
      setState(prev => ({
        ...prev,
        ...(viewLanguage === 'EN' ? { blogContentEN: updatedContent } : { blogContent: updatedContent })
      }));
      setSanityMessage({ type: 'success', text: 'Internal links added successfully!' });
      
      // Re-run SEO Analysis
      setIsAnalyzingSeo(true);
      const analysis = await analyzeSeoForBlog(
        viewLanguage === 'EN' ? state.blogTitleEN || '' : state.blogTitle || '',
        viewLanguage === 'EN' ? state.blogDescriptionEN || '' : state.blogDescription || '',
        updatedContent, 
        state.blogKeywords
      );
      if (analysis) {
        setState(prev => ({
          ...prev,
          ...(viewLanguage === 'EN' ? { seoAnalysisEN: analysis } : { seoAnalysis: analysis })
        }));
      }
      setIsAnalyzingSeo(false);
    } else {
      setSanityMessage({ type: 'error', text: 'Failed to add internal links.' });
    }
    
    setIsLinking(false);
    setTimeout(() => setSanityMessage(null), 3000);
  };

  const renderContent = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent) return null;

    const parts = currentContent.split(/\[IMAGE_PROMPT:\s*(.*?)\s*\]/g);

    return parts.map((part, index) => {
      // Even indices are markdown text
      if (index % 2 === 0) {
        return (
          <Markdown key={index}>
            {part}
          </Markdown>
        );
      }

      // Odd indices are image prompts
      const prompt = part;
      const imageState = blogImages[prompt];

      if (imageState?.url) {
        return (
          <figure key={index} className="my-10 not-prose relative group">
            <img src={imageState.url} alt="Generated blog image" className="w-full rounded-2xl shadow-md border border-zinc-100" />
            
            {/* Image Actions Overlay */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleGenerateImage(prompt)}
                disabled={imageState.loading || !geminiConfigured}
                className="p-2 bg-white/90 backdrop-blur-sm border border-zinc-200 text-zinc-700 rounded-lg hover:bg-white hover:text-zinc-900 transition-colors shadow-sm disabled:opacity-50"
                title="Regenerate Image"
              >
                <RefreshCw className={`w-4 h-4 ${imageState.loading ? 'animate-spin' : ''}`} />
              </button>
              <a
                href={imageState.url}
                download={`blog-image-${index}.png`}
                className="p-2 bg-white/90 backdrop-blur-sm border border-zinc-200 text-zinc-700 rounded-lg hover:bg-white hover:text-zinc-900 transition-colors shadow-sm"
                title="Download Image"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>

            <figcaption className="text-center text-xs text-zinc-500 mt-3 italic">{prompt}</figcaption>
          </figure>
        );
      }

      return (
        <div key={index} className="my-10 p-6 bg-zinc-50 border border-zinc-200 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 text-center not-prose transition-colors hover:bg-zinc-100/50">
          <div className="p-3 bg-white text-zinc-400 rounded-full shadow-sm border border-zinc-100 mb-1">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">Blog Image</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto line-clamp-2" title={prompt}>"{prompt}"</p>
          </div>
          <button
            onClick={() => handleGenerateImage(prompt)}
            disabled={imageState?.loading || !geminiConfigured}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 hover:text-zinc-900 transition-all disabled:opacity-50 shadow-sm"
          >
            {imageState?.loading ? (
              <><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 text-indigo-500" /> Generate Image</>
            )}
          </button>
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className={`flex-1 overflow-y-auto p-6 lg:p-8 flex gap-6 items-start ${!state.blogContent && !isGenerating ? 'justify-center' : ''}`}>
        <div className={`flex-1 ${state.blogContent ? 'max-w-3xl' : 'max-w-3xl mx-auto w-full'}`}>
          {!state.blogContent && !isGenerating ? (
            <div className="w-full h-full min-h-[500px] border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center bg-white shadow-sm">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                  <PenTool className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 tracking-tight">No blog post generated</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">Get started by setting your Product Context and clicking generate.</p>
                {!geminiConfigured && (
                  <p className="text-xs text-amber-600 mt-3">AI generate kapali. Lokal .env dosyana <code>GEMINI_API_KEY</code> ekle.</p>
                )}
                {(!state.productName && !state.blogTopic) && (
                  <p className="text-xs text-red-500 mt-3">Please set Product Context or Blog Topic first.</p>
                )}
              </div>
            </div>
          ) : isGenerating ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-zinc-900">Writing your blog post...</p>
              <p className="text-xs text-zinc-500 mt-1">This might take a few seconds.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">Draft Ready</span>
                  {sanityMessage && (
                    <span className={`ml-2 text-xs font-medium ${sanityMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sanityMessage.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {state.language === 'BOTH' && (
                    <div className="flex items-center bg-zinc-200/50 p-1 rounded-lg mr-2">
                      <button
                        onClick={() => setViewLanguage('TR')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          viewLanguage === 'TR' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                      >
                        TR
                      </button>
                      <button
                        onClick={() => setViewLanguage('EN')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          viewLanguage === 'EN' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleAddInternalLinks}
                    disabled={isLinking || !sanityConfigured}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {isLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    {isLinking ? 'Linking...' : 'Add Internal Links'}
                  </button>
                  <button
                    onClick={handlePublishToSanity}
                    disabled={isPublishing || !sanityConfigured}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    {isPublishing ? 'Publishing...' : 'Publish to Sanity'}
                  </button>
                  <button
                    onClick={() => setIsManualEditMode(!isManualEditMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                      isManualEditMode 
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' 
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {isManualEditMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                    {isManualEditMode ? 'Preview' : 'Edit Markdown'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    title="Download Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              {/* Sanity Metadata Section */}
              <div className="p-6 border-b border-zinc-100 bg-zinc-50/30">
                <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-500" />
                  Sanity Metadata
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Title</label>
                    <input 
                      type="text" 
                      value={(viewLanguage === 'EN' ? state.blogTitleEN : state.blogTitle) || ''} 
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        ...(viewLanguage === 'EN' ? { blogTitleEN: e.target.value } : { blogTitle: e.target.value })
                      }))}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Description (max 160 chars)</label>
                    <textarea 
                      value={(viewLanguage === 'EN' ? state.blogDescriptionEN : state.blogDescription) || ''} 
                      maxLength={160}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        ...(viewLanguage === 'EN' ? { blogDescriptionEN: e.target.value } : { blogDescription: e.target.value })
                      }))}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none h-20"
                    />
                    <div className="text-right text-[10px] text-zinc-400 mt-1">
                      {((viewLanguage === 'EN' ? state.blogDescriptionEN : state.blogDescription) || '').length} / 160
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Slug</label>
                      <input 
                        type="text" 
                        value={(viewLanguage === 'EN' ? state.blogSlugEN : state.blogSlug) || ''} 
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          ...(viewLanguage === 'EN' ? { blogSlugEN: e.target.value } : { blogSlug: e.target.value })
                        }))}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-mono text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Category</label>
                      <div className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-600 flex items-center">
                        {state.blogCategory ? state.blogCategory.name : 'Uncategorized'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Cover Image Section */}
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Cover Image & Alt Text</label>
                    <input 
                      type="text" 
                      value={(viewLanguage === 'EN' ? state.blogCoverAltTextEN : state.blogCoverAltText) || ''} 
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        ...(viewLanguage === 'EN' ? { blogCoverAltTextEN: e.target.value } : { blogCoverAltText: e.target.value })
                      }))}
                      placeholder="Descriptive alt text for SEO..."
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                    />
                    {(viewLanguage === 'EN' ? state.blogCoverUrlEN : state.blogCoverUrl) ? (
                      <div className="relative group rounded-xl overflow-hidden border border-zinc-200">
                        <img src={(viewLanguage === 'EN' ? state.blogCoverUrlEN : state.blogCoverUrl) as string} alt={(viewLanguage === 'EN' ? state.blogCoverAltTextEN : state.blogCoverAltText) || "Cover"} className="w-full h-auto object-cover max-h-64" />
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={handleGenerateCover}
                            disabled={isGeneratingCover || !geminiConfigured}
                            className="p-2 bg-white/90 backdrop-blur-sm border border-zinc-200 text-zinc-700 rounded-lg hover:bg-white hover:text-zinc-900 transition-colors shadow-sm disabled:opacity-50"
                            title="Regenerate Cover"
                          >
                            <RefreshCw className={`w-4 h-4 ${isGeneratingCover ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white border border-zinc-200 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center">
                        <div className="p-2 bg-zinc-50 text-zinc-400 rounded-full shadow-sm border border-zinc-100">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 max-w-md mx-auto line-clamp-2" title={(viewLanguage === 'EN' ? state.blogCoverPromptEN : state.blogCoverPrompt) || ''}>
                            "{(viewLanguage === 'EN' ? state.blogCoverPromptEN : state.blogCoverPrompt)}"
                          </p>
                        </div>
                        <button
                          onClick={handleGenerateCover}
                          disabled={isGeneratingCover || !geminiConfigured}
                          className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm disabled:opacity-50"
                        >
                          {isGeneratingCover ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> Generating...</>
                          ) : (
                            <><Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Generate Cover Image</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isManualEditMode ? (
                <div className="p-0 h-[60vh]">
                  <textarea
                    value={viewLanguage === 'EN' ? (state.blogContentEN || '') : (state.blogContent || '')}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      ...(viewLanguage === 'EN' ? { blogContentEN: e.target.value } : { blogContent: e.target.value })
                    }))}
                    className="w-full h-full p-8 font-mono text-sm text-zinc-800 bg-zinc-50 border-none resize-none focus:ring-0"
                    placeholder="Write your markdown here..."
                  />
                </div>
              ) : (
                <div className="p-8 prose prose-zinc max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-p:leading-relaxed prose-p:text-zinc-600 prose-li:text-zinc-600 prose-ul:my-6 prose-li:my-2 prose-a:text-indigo-600">
                  {renderContent()}
                </div>
              )}
              
              {/* AI Edit Bar */}
              <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                  <Wand2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                  placeholder="Ask AI to edit... (e.g. 'Make the intro punchier', 'Add a section about pricing')"
                  className="flex-1 bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-indigo-300 text-indigo-900 shadow-sm"
                  disabled={isEditing || !geminiConfigured}
                />
                <button
                  onClick={handleEdit}
                  disabled={isEditing || !editInstruction.trim() || !geminiConfigured}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-2 shadow-sm"
                >
                  {isEditing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Editing...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SEO Analysis Panel */}
        {state.blogContent && (
          <div className="w-80 shrink-0 space-y-4 sticky top-0">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-zinc-900">SEO Analysis</h3>
              </div>
              
              <div className="p-5 space-y-6">
                {isAnalyzingSeo ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-3" />
                    <p className="text-xs font-medium text-zinc-900">Analyzing SEO strength...</p>
                  </div>
                ) : (viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis) ? (
                  <>
                    {/* Score */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-indigo-100 mb-2 relative">
                        <span className="text-2xl font-bold text-indigo-600">{(viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis)?.score}</span>
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8" className="text-indigo-500" strokeDasharray={`${((viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis)?.score || 0) * 2.89} 289`} />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">SEO Score</p>
                    </div>

                    {/* Keywords */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        Keyword Density
                      </h4>
                      <div className="space-y-2">
                        {(viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis)?.keywords.map((kw, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-600 truncate pr-2">{kw.word}</span>
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium shrink-0">
                              {kw.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggestions */}
                    {((viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis)?.suggestions || []).length > 0 && (
                      <div className="space-y-3 pt-4 border-t border-zinc-100">
                        <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          Suggestions
                        </h4>
                        <ul className="space-y-2">
                          {(viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis)?.suggestions.map((sug, i) => (
                            <li key={i} className="text-xs text-zinc-600 leading-relaxed flex items-start gap-2">
                              <span className="w-1 h-1 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-500">Analysis failed. Try generating again.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Social Media Snippets Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">Social Promo</h3>
                </div>
                {!socialPosts && (
                  <button
                    onClick={handleGenerateSocial}
                    disabled={isGeneratingSocial || !geminiConfigured}
                    className="text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isGeneratingSocial ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate
                  </button>
                )}
              </div>
              
              <div className="p-5">
                {isGeneratingSocial ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mb-2" />
                    <p className="text-xs text-zinc-500">Writing social posts...</p>
                  </div>
                ) : socialPosts ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-zinc-900">
                        <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                        <span className="text-xs font-semibold">Twitter (X)</span>
                      </div>
                      <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {socialPosts.twitter}
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(socialPosts.twitter);
                          // Optional: show a tiny toast
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-zinc-900">
                        <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                        <span className="text-xs font-semibold">LinkedIn</span>
                      </div>
                      <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {socialPosts.linkedin}
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(socialPosts.linkedin);
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Generate engaging Twitter and LinkedIn posts to promote this article.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
