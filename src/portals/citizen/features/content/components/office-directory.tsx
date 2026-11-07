'use client';

import { useState } from 'react';
import { searchOffices, type Office } from '@/portals/citizen/features/content/lib/office-directory';
import { telHref } from '@/portals/citizen/lib/contact-info';

const detailLabelStyle = { fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 2 } as const;
const detailValueStyle = { fontSize: 14, color: '#333333', lineHeight: 1.6 };

function OfficeCard({ office }: { office: Office }) {
  return (
    <li style={{ padding: '18px 20px', background: '#F5F9FC', borderRadius: 6 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', lineHeight: 1.4, marginBottom: 12 }}>{office.name}</h3>
      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr)', gap: 16 }}>
        <div>
          <p style={detailLabelStyle}>Address</p>
          <p style={detailValueStyle}>{office.address}</p>
        </div>
        <div>
          <p style={detailLabelStyle}>Telephone</p>
          <a href={telHref(office.phone)} style={{ ...detailValueStyle, color: '#003DA5', textDecoration: 'none' }}>{office.phone}</a>
        </div>
        <div>
          <p style={detailLabelStyle}>Operating Hours</p>
          <p style={detailValueStyle}>{office.hours}</p>
        </div>
      </div>
    </li>
  );
}

/** About > Directory: every listed office, narrowed by a search box. */
export default function OfficeDirectory() {
  const [query, setQuery] = useState('');
  const offices = searchOffices(query);

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>Directory</h2>
      <p style={{ fontSize: 14, color: '#666666', marginBottom: 20 }}>Government offices and public service contacts in Lucena City</p>

      <label htmlFor="directory-search" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
        Search the directory
      </label>
      <input
        id="directory-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Office name, address, or number"
        style={{ width: '100%', maxWidth: 480, padding: '10px 14px', fontSize: 14, border: '1px solid #BBBBBB', borderRadius: 6, background: 'white' }}
      />
      <p role="status" style={{ fontSize: 13, color: '#666666', margin: '12px 0 20px' }}>
        {offices.length === 0
          ? `No offices match "${query.trim()}".`
          : `${offices.length} ${offices.length === 1 ? 'office' : 'offices'}`}
      </p>

      <ul style={{ display: 'grid', gap: 12, listStyle: 'none' }}>
        {offices.map((office) => (
          <OfficeCard key={office.name} office={office} />
        ))}
      </ul>
    </div>
  );
}
