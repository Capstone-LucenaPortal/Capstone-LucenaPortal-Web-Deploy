'use client';

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function ExploreLucenaPage() {
  return (
    <>
      {/* Hero */}
      <section className="stack-mobile" style={{ padding: '64px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 800, color: '#003DA5', lineHeight: 1.1, marginBottom: 20 }}>
            EXPERIENCE<br />LUCENA
          </h1>
          <p style={{ fontSize: 16, color: '#555555', lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
            The capital of Quezon, gateway to the province, and home of the chami. Here&apos;s where to go, what to eat, where to study, and what keeps the city running.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            {[
              { label: 'Where to Go', meta: '8 places', href: '#where-to-go' },
              { label: 'Where to Eat', meta: '8 restaurants', href: '#where-to-eat' },
              { label: 'Where to Study', meta: '10 schools', href: '#where-to-study' },
              { label: 'City Infrastructure', meta: 'Health & transport', href: '#city-infrastructure' },
            ].map((btn) => (
              <a
                key={btn.href}
                href={btn.href}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#003DA5', color: 'white', borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
              >
                {btn.label}
                <span style={{ fontWeight: 400, opacity: 0.85 }}>{btn.meta}</span>
                <span aria-hidden>→</span>
              </a>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 16, aspectRatio: '4 / 3', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/0107perez-park-2.jpg"
            alt="Aerial view of Perez Park, Lucena City"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </section>

      {/* Where to Go */}
      <section id="where-to-go" style={{ padding: '64px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#C0272D', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Where to Go</p>
        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#003DA5', marginBottom: 16, lineHeight: 1.15 }}>Eight Places That Are Lucena</h2>
        <p style={{ fontSize: 15, color: '#666666', maxWidth: 640, marginBottom: 40, lineHeight: 1.7 }}>
          Parks, landmarks, waterfront, and the market. Ratings shown are current Google ratings, so visitors know what they&apos;re walking into.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            { badge: 'PARK', name: 'Perez Park', desc: 'The heart of the city. Jogging paths, playgrounds, open lawns, and live events. Open 24 hours.', meta: '★ 4.5 · 937 reviews', image: '/Perez Park.jpg', query: 'Perez Park, Lucena City' },
            { badge: 'HERITAGE', name: 'St. Ferdinand Cathedral', desc: "The city's cathedral and its most-loved landmark — one of the historic Catholic churches of Quezon.", meta: '★ 4.7 · 708 reviews', image: '/St. Ferdinand Cathedral.jpg', query: 'St. Ferdinand Cathedral, Lucena City' },
            { badge: 'LANDMARK', name: 'Quezon Provincial Capitol', desc: 'Seat of the provincial government, set on a landscaped hilltop overlooking the city.', meta: 'Capitol Site, Lucena City', image: '/Quezon Provincial Capitol.jpg', query: 'Quezon Provincial Capitol, Lucena City' },
            { badge: 'MARKET', name: 'Lucena Fish Port & Public Market', desc: "Fresh catch straight off the boats alongside the city's produce stalls. Busiest before sunrise.", meta: 'Dalahican, Lucena City', image: '/Lucena Fish Port _ Public Market_.jpg', query: 'Lucena Fish Port & Public Market, Dalahican, Lucena City' },
            { badge: 'WATERFRONT', name: 'Lucena City Baywalk', desc: 'A stretch along Tayabas Bay for evening walks, food stalls, and sunset views.', meta: 'Barra, Lucena City', image: '/Lucena City Baywalk.jpg', query: 'Lucena City Baywalk, Barra, Lucena City' },
            { badge: 'NATURE', name: 'Munting Talao-Talao Beach Resort', desc: "A quiet coastal getaway on the city's outskirts, popular for day trips and swimming.", meta: 'Talao-Talao, Lucena City', image: '/Munting Talao-Talao Beach Resort.jpg', query: 'Munting Talao-Talao Beach Resort, Lucena City' },
            { badge: 'GARDEN', name: 'Botanical Garden & Arboretum', desc: 'Greenery and shaded trails within the city, home to native trees and plant species.', meta: 'Lucena City', image: '/Botanical Garden & Arboretum.jpg', query: 'Botanical Garden & Arboretum, Lucena City' },
            { badge: 'HERITAGE', name: 'Minor Basilica of St. Michael the Archangel', desc: 'One of the oldest and most storied churches in the province — a short drive from the city, in neighbouring Tayabas.', meta: 'Tayabas City, Quezon', image: '/Minor Basilica of St. Michael the Archangel.jpg', query: 'Minor Basilica of St. Michael the Archangel, Tayabas City, Quezon' },
          ].map((place) => (
            <a key={place.name} href={mapsUrl(place.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(place.image)}
                  alt={place.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{place.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{place.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 12 }}>{place.desc}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5' }}>{place.meta}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Where to Eat */}
      <section id="where-to-eat" style={{ padding: '64px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', background: '#F5F9FC' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#C0272D', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Where to Eat</p>
        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#003DA5', marginBottom: 16, lineHeight: 1.15 }}>Cafes, Bistros &amp; Local Favourites</h2>
        <p style={{ fontSize: 15, color: '#666666', maxWidth: 640, marginBottom: 40, lineHeight: 1.7 }}>
          From all-day cafes to family-style Filipino spots, here&apos;s where Lucena actually eats. And don&apos;t skip the chami — the city&apos;s own noodle dish, celebrated every May at the Chami Festival.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            { badge: 'FILIPINO', name: 'Bubbles Crispy Pata & Restaurant', desc: 'Crispy pata, calamares, and a table full of Filipino comfort food built for sharing.', image: '/Bubbles crispy pata and restaurant.jpg', query: 'Bubbles Crispy Pata & Restaurant, Lucena City' },
            { badge: 'PANSIT HABHAB', name: "Buddy's", desc: 'Pancit habhab plated tableside alongside grilled barbecue and garlic rice.', image: '/Buddys.jpg', query: "Buddy's, Lucena City" },
            { badge: 'CAFE', name: 'Cafe Antigua', desc: 'All-day breakfast plates — tapa, eggs, avocado, and refried beans — in a cozy setting.', image: '/Cafe Antigua.jpg', query: 'Cafe Antigua, Lucena City' },
            { badge: 'CAFE', name: 'Cafe Jungle', desc: 'Wood-fired pizza and pasta by the plateful, from creamy carbonara to pesto and marinara.', image: '/Cafe Jungle.jpg', query: 'Cafe Jungle, Lucena City' },
            { badge: 'RESTAURANT', name: 'Cafe Tukan', desc: 'A menu that spans pizza, sisig, curly fries, sandwiches, and dessert — something for every craving.', image: '/Cafe tukan.jpg', query: 'Cafe Tukan, Lucena City' },
            { badge: 'COFFEE', name: 'Daily Dose', desc: 'Iced coffee and specialty drinks topped with cookie crumble and cream.', image: '/Daily dose.jpg', query: 'Daily Dose, Lucena City' },
            { badge: 'CAFE & RESTAURANT', name: 'Luisa Cafe & Restaurant', desc: 'Silog-style plates — fried chicken, garlic rice, and egg — done right.', image: '/Luisa Cafe & Restaurant.jpg', query: 'Luisa Cafe & Restaurant, Lucena City' },
            { badge: 'BISTRO', name: 'Lutgarda Bistro & Private Rooms', desc: 'Pancit habhab loaded with vegetables and crackling, served with sandwiches on the side.', image: '/Lutgarda bistro & private rooms.jpg', query: 'Lutgarda Bistro & Private Rooms, Lucena City' },
          ].map((place) => (
            <a key={place.name} href={mapsUrl(place.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(place.image)}
                  alt={place.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{place.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{place.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6 }}>{place.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Where Lucena Studies */}
      <section id="where-to-study" style={{ padding: '64px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#C0272D', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Education</p>
        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#003DA5', marginBottom: 16, lineHeight: 1.15 }}>Where Lucena Studies</h2>
        <p style={{ fontSize: 15, color: '#666666', maxWidth: 640, marginBottom: 40, lineHeight: 1.7 }}>
          Ten higher-education institutions in the city, from the free city college to the province&apos;s largest university.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            { name: 'Manuel S. Enverga University Foundation (MSEUF)', address: 'Enverga Blvd, Brgy. Ibabang Dupay', badge: 'AUTONOMOUS UNIVERSITY', desc: 'Founded in 1947 and the only Autonomous University in Quezon, MSEUF holds the second-highest number of accredited programs in all of Southern Tagalog, behind only UP Los Baños. Known for law, criminology, engineering, architecture, and maritime education.', image: '/Manuel S. Enverga University Foundation.jpg', query: 'Manuel S. Enverga University Foundation, Lucena City' },
            { name: 'Southern Luzon State University — Lucena Campus', address: 'Brgy. Ibabang Dupay', badge: 'STATE UNIVERSITY', desc: "The city's state university campus, offering a subsidized public-university education close to home. Open Mon–Fri, 8AM–5PM.", image: '/Southern Luzon State University — Lucena Campus.png', query: 'Southern Luzon State University Lucena Campus, Lucena City' },
            { name: 'Dalubhasaan ng Lungsod ng Lucena (DLL)', address: 'City Hall Annex, Brgy. Isabang', badge: 'FREE TUITION · LGU', desc: "The city's own college, run by the LGU with free tuition for every enrolled student. Consistently ranked among Lucena's top-performing institutions.", image: '/Dalubhasaan ng Lungsod ng Lucena (DLL).jpg', query: 'Dalubhasaan ng Lungsod ng Lucena, Lucena City' },
            { name: 'St. Augustine', address: 'Carlos Drug cor. Tao Arao St', badge: 'NURSING & ALLIED HEALTH', desc: 'A specialist institution focused on nursing and allied health programs, located in the downtown core near Quezon Avenue.', image: '/Screenshot 2026-07-22 232100.png', query: 'St. Augustine School, Lucena City' },
            { name: 'Maryhill College', address: 'M.L. Tagarao St', badge: 'CATHOLIC', desc: 'Founded in 1938 as Lucena Catholic School under the Maryknoll Sisters, it is the oldest Catholic school in the city and in 1975 became the first accredited school in all of Quezon Province. Now under the Diocese of Lucena, offering preschool through college in business, education, IT, and nursing.', image: '/Maryhill College.jpg', query: 'Maryhill College, Lucena City' },
            { name: 'Sacred Heart College', address: '1 Merchan St', badge: 'CATHOLIC', desc: 'A long-established Catholic institution and a defining landmark of Merchan Street, offering basic education through college. Top 1 nursing school in Lucena City. Known for its quality education.', image: '/Sacred Heart College.jpg', query: 'Sacred Heart College, Lucena City' },
            { name: 'St. Anne College Lucena', address: 'Brgy. Isabang', badge: 'PRIVATE', desc: "A private college on the city's northern edge, known for its green, tree-lined campus. Affiliated with St. Anne General Hospital.", image: '/St. Anne College Lucena.jpg', query: 'St. Anne College Lucena' },
            { name: 'STI College Lucena', address: '', badge: 'PRIVATE', desc: 'Branch of the national STI network, focused on IT, computer science, business, and tourism with an industry-placement emphasis.', image: '/STI Lucena.jpg', query: 'STI College Lucena' },
            { name: 'AMA Computer College', address: 'M.L. Tagarao St', badge: 'PRIVATE', desc: "Branch of the Philippines' first and largest ICT-focused college network, offering computer science, IT, and engineering alongside short vocational tracks. Open daily, 9AM–5PM.", image: '/AMA College.jpg', query: 'AMA Computer College, Lucena City' },
            { name: 'QCRS College, Inc.', address: 'MZ Garcia Bldg., Allarey cor. Magallanes St', badge: 'PRIVATE', desc: 'A private college in the downtown commercial core. Open Mon–Fri, 8:30AM–4:30PM.', image: '/Screenshot 2026-07-22 180209.png', query: 'QCRS College, Lucena City' },
          ].map((school) => (
            <a key={school.name} href={mapsUrl(school.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', background: '#003DA5', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {school.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={encodeURI(school.image)}
                    alt={school.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Image</span>
                )}
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{school.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{school.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: school.address ? 12 : 0 }}>{school.desc}</p>
                {school.address && <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5' }}>{school.address}</p>}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* What Keeps the City Running */}
      <section id="city-infrastructure" style={{ padding: '64px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', background: '#F5F9FC' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#C0272D', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Infrastructure</p>
        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#003DA5', marginBottom: 16, lineHeight: 1.15 }}>What Keeps the City Running</h2>
        <p style={{ fontSize: 15, color: '#666666', maxWidth: 640, marginBottom: 40, lineHeight: 1.7 }}>
          Hospitals, ports, terminals, and the industries behind them. Lucena is the transport gateway of Quezon and a coconut-oil manufacturing hub — most of the province moves through, or is processed in, this city.
        </p>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#666666', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>Hospitals</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 40 }}>
          {[
            { name: 'Quezon Medical Center', meta: 'Quezon Ave · Open 24 hours · ★ 2.8 (90)', badge: 'GOVERNMENT', desc: "The city's main government hospital and the primary public referral center for Quezon province, serving patients who cannot access private care. Its rating is the lowest on this list, reflecting well-documented strain on capacity, queuing, and facilities.", image: '/Quezon Medical Center.jpg', query: 'Quezon Medical Center, Lucena City' },
            { name: 'Mount Carmel Diocesan General Hospital', meta: 'Open 24 hours · ★ 3.3 (77)', badge: 'PRIVATE', desc: 'A private hospital operated under the Diocese of Lucena, located in the city center near Quezon Avenue. Offers full emergency, laboratory, and inpatient services.', image: '/Mount Carmel Diocesan General Hospital.jpg', query: 'Mount Carmel Diocesan General Hospital, Lucena City' },
            { name: 'Lucena United Doctors Hospital & Medical Center', meta: 'Open 24 hours · ★ 3.8 (173)', badge: 'PRIVATE', desc: 'The highest-rated and most-reviewed private hospital in the city, recently renovated into a newer, more modern facility. Patients consistently single out its ICU and nursing staff.', image: '/Lucena United Doctors Hospital & Medical Center.jpg', query: 'Lucena United Doctors Hospital & Medical Center, Lucena City' },
            { name: 'Lucena MMG General Hospital', meta: 'Old Manila S Rd · Open 24 hours · ★ 3.0 (46)', badge: 'PRIVATE', desc: "A private general hospital on the city's eastern approach, offering emergency, ward, and laboratory services.", image: '/Lucena MMG General Hospital.jpg', query: 'Lucena MMG General Hospital, Lucena City' },
            { name: 'St. Anne General Hospital', meta: 'P. Gomez Ext, Ibabang Dupay · Open 24 hours · ★ 3.6 (47)', badge: 'PRIVATE', desc: 'A private medical center in Ibabang Dupay, affiliated with St. Anne College Lucena. Noted by patients for cleanliness and orderliness.', image: '/St. Anne General Hospital.jpg', query: 'St. Anne General Hospital, Lucena City' },
          ].map((h) => (
            <a key={h.name} href={mapsUrl(h.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', background: '#003DA5', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(h.image)}
                  alt={h.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{h.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{h.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 12 }}>{h.desc}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5' }}>{h.meta}</p>
              </div>
            </a>
          ))}
        </div>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#666666', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>Transport &amp; Gateways</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 40 }}>
          {[
            { name: 'Port of Lucena / Dalahican Ferry Terminal', meta: 'RoRo to Marinduque, Masbate, Batangas · ★ 4.2 (216)', badge: 'SEAPORT', desc: 'The city’s seaport and Quezon’s main maritime gateway, running RoRo and ferry services to Marinduque, Masbate, and Batangas with vehicle loading available. Crossing to Marinduque takes roughly 2.5 hours; multiple operators serve the route.', image: '/Port of Lucena.jpg', query: 'Port of Lucena, Dalahican, Lucena City' },
            { name: 'Lucena Grand Central Terminal', meta: 'North & South bound bays · LTO, OWWA, MARINA, NBI offices on site · ★ 4.3 (582)', badge: 'LAND TRANSPORT', desc: "The province's principal land transport hub, with separate northbound and southbound bays serving Manila (Cubao, Buendia) and the Bicol corridor. Uniquely, it also houses LTO, OWWA, MARINA, and NBI offices on site, making it a civic destination as well as a terminal.", image: '/Lucena Grand Central Terminal.jpg', query: 'Lucena Grand Central Terminal, Lucena City' },
            { name: 'SM City Lucena', meta: 'Maharlika Highway cor. Dalahican Rd · ★ 4.3 (4,331)', badge: 'COMMERCIAL', desc: "The city's major shopping and lifestyle mall, anchoring commercial activity along Maharlika Highway.", image: '/SM City Lucena.jpg', query: 'SM City Lucena' },
          ].map((t) => (
            <a key={t.name} href={mapsUrl(t.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', background: '#003DA5', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(t.image)}
                  alt={t.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{t.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{t.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 12 }}>{t.desc}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5' }}>{t.meta}</p>
              </div>
            </a>
          ))}
        </div>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#666666', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>Industry &amp; Major Employers</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 8 }}>
          {[
            { name: 'San Miguel Brewery Inc. — Lucena', meta: 'Old Manila South Rd', badge: 'MANUFACTURING', desc: "The city's flagship industrial locator and a major manufacturing employer, part of the country's largest food and beverage conglomerate. A separate sales office operates on Maharlika Highway in Ibabang Iyam.", image: '/San Miguel Brewery Inc. - Lucena.jpg', query: 'San Miguel Brewery Inc, Old Manila South Road, Lucena City' },
            { name: 'JNJ Oil Industries Inc.', meta: 'Maharlika Highway', badge: 'COCONUT OIL', desc: 'One of the largest coconut oil manufacturers in the city, and a direct expression of Lucena’s identity as the "Cocopalm City of the South." Its sister firm, JNJ Oleochemicals in Brgy. Cotta, runs 24 hours producing oil-derived chemical products. Open Mon–Sat.', image: '/JNJ Oil Industries Inc..jpg', query: 'JNJ Oil Industries Inc, Maharlika Highway, Lucena City' },
            { name: 'Coca-Cola Europacific Aboitiz Philippines — Lucena DC', meta: 'Quezon Eco Tourism Rd · Open 24 hours', badge: 'DISTRIBUTION', desc: "Coca-Cola's round-the-clock distribution hub for the Quezon corridor, now operating under the Aboitiz Group's bottling partnership.", image: '/Coca-Cola EuroPacific Aboitiz.jpg', query: 'Coca-Cola Europacific Aboitiz Philippines Lucena, Quezon Eco Tourism Road, Lucena City' },
            { name: 'Monaco Oil Mill Incorporated', meta: 'Lucena City · Open Mon–Sat, 8AM–5PM', badge: 'COCONUT OIL', desc: "A working coconut oil mill that buys copra and coconut shells daily and produces crude coconut oil and copra cake in bulk — the link between the city's mills and coconut farmers across Quezon.", image: '/Monaco Oil Mill.jpg', query: 'Monaco Oil Mill Incorporated, Lucena City' },
            { name: 'Empire Oil Integrated Manufacturing Corporation', meta: 'Lucena City · Open Mon–Sat, 8AM–5PM', badge: 'OIL MANUFACTURING', desc: "An integrated oil manufacturing firm on the city's eastern side, and the best-reviewed industrial company in Lucena.", image: '/Empire Oil Integrated.jpg', query: 'Empire Oil Integrated Manufacturing Corporation, Lucena City' },
          ].map((c) => (
            <a key={c.name} href={mapsUrl(c.query)} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative', background: '#003DA5', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={encodeURI(c.image)}
                    alt={c.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Image</span>
                )}
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'white', color: '#003DA5', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px' }}>{c.badge}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{c.name}</h3>
                <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 12 }}>{c.desc}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5' }}>{c.meta}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
