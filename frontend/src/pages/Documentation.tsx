import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocFile {
  label: string;
  filename: string;
}

const DOC_FILES: DocFile[] = [
  { label: 'Platform Overview', filename: 'platform_overview.md' },
  { label: 'Repo Structure', filename: 'repo_structure.md' },
  { label: 'Frontend Architecture', filename: 'frontend_architecture.md' },
];

/**
 * Extracts mermaid code blocks and renders them inline using mermaid.js.
 * Non-mermaid code blocks use standard pre/code rendering.
 */
function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import to avoid SSR issues
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#e6335f',
            primaryBorderColor: '#ff6b4a',
            primaryTextColor: '#f0f0f5',
            lineColor: '#5a5f72',
            secondaryColor: '#1a1b26',
            tertiaryColor: '#12131a',
            background: '#12131a',
            mainBkg: '#1a1b26',
            nodeBorder: '#ff6b4a',
            clusterBkg: '#12131a',
            titleColor: '#f0f0f5',
            edgeLabelBackground: '#12131a',
          },
          fontFamily: 'Inter, sans-serif',
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        console.warn('Mermaid render error:', err);
        if (!cancelled) setSvg(`<pre style="color:#ef4444">${String(err)}</pre>`);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (!svg) {
    return (
      <div className="docs-content" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div
      className="mermaid"
      style={{
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-xl)',
        margin: 'var(--space-lg) 0',
        overflowX: 'auto',
        textAlign: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function Documentation() {
  const [activeDoc, setActiveDoc] = useState(0);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/docs/${DOC_FILES[activeDoc].filename}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load doc:', err);
        setContent(`# Error\n\nFailed to load \`${DOC_FILES[activeDoc].filename}\`. Make sure the docs directory is served by Vite.`);
        setLoading(false);
      });
  }, [activeDoc]);

  return (
    <div className="docs-container">
      {/* Doc picker tabs */}
      <nav className="docs-nav">
        {DOC_FILES.map((doc, i) => (
          <button
            key={doc.filename}
            className={`docs-nav-item ${i === activeDoc ? 'active' : ''}`}
            onClick={() => setActiveDoc(i)}
          >
            {doc.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading documentation...</p>
        </div>
      ) : (
        <div className="docs-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Intercept fenced code blocks to handle mermaid
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const lang = match?.[1];
                const codeStr = String(children).replace(/\n$/, '');

                if (lang === 'mermaid') {
                  return <MermaidBlock code={codeStr} />;
                }

                // Check if this is an inline code or a block
                const isInline = !className;
                if (isInline) {
                  return <code {...props}>{children}</code>;
                }

                return (
                  <pre>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              // Wrap pre tags from markdown
              pre({ children }) {
                return <>{children}</>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
