import { ExternalLink } from 'lucide-react';

export default function Link({ href, target = '_blank', children }) {
  return (
    <a
      href={href}
      target={target}
      rel={target === '_blank' && 'noopener noreferrer'}
      className={'inline-flex align-middle gap-1'}
    >
      {target === '_blank' && (
        <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
      )}
      {children}
    </a>
  );
}
