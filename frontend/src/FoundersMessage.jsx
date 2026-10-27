import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Quote, Globe, ArrowRight, ArrowUp } from 'lucide-react'

export default function FoundersMessage() {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '60px' }}>
      
      {/* New Hero Section (Full Width) */}
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', marginBottom: '40px' }}>
        <picture style={{ width: '100%', height: '100%', display: 'block' }}>
          <source media="(max-width: 768px)" srcSet="/Rahul-karad.png" />
          <img src="/Dr-Rahul-Karad.png" alt="Dr. Rahul V. Karad" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }} />
        </picture>
        
        {/* Dark Overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)' }} />
        
        {/* Text Overlay */}
        <div style={{ position: 'absolute', bottom: '40px', left: '40px', color: 'white' }}>
          <h1 style={{ fontSize: '42px', fontWeight: '800', marginBottom: '10px' }}>Dr. Rahul V. Karad</h1>
          <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Educationist</p>
          <p style={{ fontSize: '18px', fontWeight: '500', color: '#cbd5e1', margin: 0 }}>Founder, Life Awakening Program</p>
        </div>
      </div>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 20px' }}>

        {/* Message Card */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '40px', position: 'relative', border: '1px solid #e2e8f0', borderTop: '5px solid #2563eb', overflow: 'hidden' }}>
          <img src="/pattern2.png" alt="" style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', opacity: 0.05, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.1 }}>
            <Quote size={80} color="#2563eb" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' }}>Founder's Message</h2>
          
          <blockquote style={{ fontSize: '18px', fontWeight: '700', color: '#1d4ed8', margin: '0 0 20px 0', fontStyle: 'italic', borderLeft: '4px solid #2563eb', paddingLeft: '15px' }}>
            "जननी जन्मभूमिश्च स्वर्गादपि गरीयसी...!"
          </blockquote>
          <div style={{ color: '#334155', lineHeight: 1.8, fontSize: '15px' }}>
            <p style={{ fontWeight: '600' }}>Dear Students/Changemakers,</p>
            <p>Greetings from Life Awakening Program (LTC), Daund.</p>
            <p>With the power that pervasive technology and media gives you, you wonder about the pace with which change is happening around you and how you could do this better. You have seen or have been informed by your parents and grandparents, about the rewards of their ways of life and its pace and wonder how these should be not neglected in contemporary life. You are not alone!</p>
            <p>Inspired from the vision of my mother, Late Smt. Urmilatai Karad, a distinguished poet, writer and pioneer who believed that education blossoms when it nourishes the whole being, at LTC, we honour her legacy by creating vibrant and transformative spaces where experiential learning meets timeless wisdom, youth are empowered to discover their infinite potential while reconnecting them with community life and nature. You will observe, that crafting tangible skills, builds both, inner fortitude and outward mastery that informs you of your inherent purpose and kindles the spirit of selfless service to our motherland. This also cultivates leadership that is forged in the crucible of nature’s resilience and illuminated by unwavering clarity.</p>
            <p>We at LTC, believe that the integration of agriculture and nature, physical fitness and sports, leadership and team building, spirituality and wisdom and patriotism and nation building, with mainstream education is essential for transforming one’s life towards making it meaningful and rewarding for oneself and all. </p>
            <p>LTC beckons you to this transformative experience. Be open in mind and at heart to the journey that awaits you. A journey to dream of a better future and build it too.</p>
            <p>Let us walk this path together-with resolve, reverence, and responsibility...!</p>
            <p style={{ fontWeight: '600' }}>Jai Bharat, Jai Jagat…!</p>
            
            <p style={{ marginTop: '20px', fontWeight: '600' }}>
              Dr. Rahul V. Karad<br/>
              Educationist<br/>
              Founder, LTC
            </p>
          </div>
        </div>

        {/* Vice Chancellor's Message Card */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
          <img src="/pattern2.png" alt="" style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', opacity: 0.05, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
            <img src="/Dr-R-M-Chitnis.png" alt="Dr. R. M. Chitnis" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }} />
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Vice Chancellor's Message</h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>MIT World Peace University, Pune</p>
            </div>
          </div>
          <div style={{ color: '#334155', lineHeight: 1.8, fontSize: '15px' }}>
            <p style={{ fontWeight: '600' }}>Dear Students / Participants,</p>
            <p>The Life Awakening Program (LTC) stands as a powerful embodiment of the philosophy of “Education for Life, not merely for a living.” While an independent initiative, it beautifully complements the larger vision we uphold at MIT World Peace University — nurturing holistic human development. </p>
            <p>The visionary dream of Dr. Rahul Vishwanath Karad has taken meaningful shape through the establishment of the LTC, creating a unique platform dedicated to experiential learning and inner transformation.</p>
            <p>In today’s fast-paced world, education must extend beyond academic achievement to cultivate mindfulness, balance, character, and purpose. The Life Awakening Program offers transformative experiences built upon five pillars — Agriculture & Nature, Physical Fitness & Sports, Team Building & Leadership, Spirituality & Peace, and Patriotism & Nation Building. LTC nurtures responsible, resilient, and compassionate individuals prepared to contribute meaningfully to society and the nation. </p>
            <p>We look forward to meaningful opportunities for collaboration, through which students of MIT-WPU can greatly benefit from the enriching programs and transformative environment offered by the Centre. </p>
            <p>This brochure captures the essence and impact of the LTC. At MIT-WPU, we value initiatives that promote wisdom, compassion, and global harmony. In this spirit, LTC stands as a significant and inspiring endeavour, guiding generations toward purposeful and peaceful living.</p>
            
            <p style={{ marginTop: '20px', fontWeight: '600' }}>
              Dr. R. M. Chitnis<br/>
              Vice Chancellor<br/>
              MIT World Peace University, Pune
            </p>
          </div>
        </div>

        {/* Chief Academic Officer's Message Card */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
          <img src="/pattern2.png" alt="" style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', opacity: 0.05, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
            <img src="/Dr-Prasad-Khandekar.png" alt="Dr. Prasad Khandekar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }} />
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Chief Academic Officer’s Message</h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>MIT World Peace University, Pune</p>
            </div>
          </div>
          <div style={{ color: '#334155', lineHeight: 1.8, fontSize: '15px' }}>
            <p style={{ fontWeight: '600' }}>Dear Students / Participants,</p>
            <p>The Life Awakening Program (LTC) represents a meaningful step toward deepening experiential and value-based learning for today’s generation. As an independent initiative, it creates a dynamic environment where education extends beyond academics to nurture clarity of thought, strength of character, and balance in life.</p>
            <p>Through its Five Foundational Pillars — Agriculture & Nature, Physical Fitness & Sports, Leadership & Team Building, Patriotism & Nation Building, and Spirituality & Peace — LTC offers structured opportunities for students to engage with real-world experiences that foster self-awareness, resilience, and purposeful growth.</p>
            <p>This spirit of holistic development at LTC resonates strongly with the journey of MIT World Peace University. The transformation of the MIT Group of Institutions into MIT World Peace University reflects a visionary path inspired by our Revered Founder, Prof. Dr. Vishwanath D. Karad — to integrate Peace as a vital dimension of education. Rooted in his philosophy of the “Union of Science and Spirituality,” MIT-WPU remains committed to shaping individuals who combine academic excellence with moral strength, social responsibility, and spiritual depth. </p>
            <p>In this shared spirit, initiatives like LTC strengthen our collective mission of blending knowledge with wisdom and competence with character, contributing to the development of compassionate, responsible, and visionary global citizens prepared to serve society.</p>
            
            <p style={{ marginTop: '20px', fontWeight: '600' }}>
              Dr. Prasad Khandekar<br/>
              Chief Academic Officer<br/>
              MIT World Peace University, Pune
            </p>
          </div>
        </div>

      </div>

      {/* Footer from Landing Page */}
      <footer style={{ background: '#000', color: 'white', padding: '60px 40px', position: 'relative', overflow: 'hidden', marginTop: '60px' }}>
        {/* Subtle Grid Pattern Background */}
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          opacity: 0.5
        }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          
          {/* Top Row: Logo and Socials */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
            {/* Logo area */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/ltc.png" alt="LTC Logo" style={{ height: '50px', objectFit: 'contain' }} />
            </div>

            {/* Social Icons */}
            <div style={{ display: 'flex', gap: '20px', color: '#94a3b8' }}>
              <Globe size={20} style={{ cursor: 'pointer' }} />
              <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>FB</span>
              <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>IG</span>
              <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>X</span>
              <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>YT</span>
              <span style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>IN</span>
            </div>
          </div>

          {/* Grid Row: Columns and Newsletter */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '40px' }}>
            
            {/* About Us */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>About Us</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <li style={{ cursor: 'pointer' }}>What is LTC</li>
                <li style={{ cursor: 'pointer' }}>Roots at MIT-WPU</li>
                <li style={{ cursor: 'pointer' }}>Philosophy: Soil to Soul</li>
                <li style={{ cursor: 'pointer' }}>The Sacred Yajña</li>
                <li style={{ cursor: 'pointer' }}>What Makes LTC Unique</li>
                <li style={{ cursor: 'pointer' }}>Anubhavāmṛta Sevita</li>
                <li style={{ cursor: 'pointer' }}>Rooted in Bharat</li>
                <li style={{ cursor: 'pointer' }}>The Birth of a Movement</li>
                <li style={{ cursor: 'pointer' }}>NEP 2020</li>
              </ul>
            </div>

            {/* Program */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Program</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <li style={{ cursor: 'pointer' }}><Link to="/programs#What-is-LAP">What is LAP</Link></li>
                <li style={{ cursor: 'pointer' }}>Program Pedagogy</li>
                <li style={{ cursor: 'pointer' }}>Experiential Learning</li>
                <li style={{ cursor: 'pointer' }}>Code of Conduct</li>
              </ul>
            </div>

            {/* Five Pillars */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Five Pillars</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <li style={{ cursor: 'pointer' }}>Agriculture & Nature</li>
                <li style={{ cursor: 'pointer' }}>Physical Fitness & Sports</li>
                <li style={{ cursor: 'pointer' }}>Team Building & Leadership</li>
                <li style={{ cursor: 'pointer' }}>Patriotism & Nation Building</li>
                <li style={{ cursor: 'pointer' }}>Spirituality & Peace</li>
              </ul>
            </div>

            {/* Campus */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Campus</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <li style={{ cursor: 'pointer' }}>Learning & Reflection Spaces</li>
                <li style={{ cursor: 'pointer' }}>Spaces for Inner & Outer Growth</li>
                <li style={{ cursor: 'pointer' }}>Living & Wellness Facilities</li>
                <li style={{ cursor: 'pointer' }}>Map Zone 2</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Contact</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '2' }}>
                <li style={{ cursor: 'pointer' }}>Send Us a Message</li>
                <li style={{ cursor: 'pointer' }}>FAQs</li>
                <li style={{ cursor: 'pointer' }}>Address Details</li>
                <li style={{ cursor: 'pointer' }}>Google Map</li>
              </ul>
            </div>

            {/* Newsletter */}
            <div style={{ gridColumn: 'span 2' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>Newsletter Signup</h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px', lineHeight: '1.6' }}>By subscribing to our mailing list you will always be updated with the latest news from us.</p>
              <div style={{ display: 'flex', background: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                <input type="email" placeholder="Enter your Email" style={{ flex: 1, padding: '10px 15px', border: 'none', outline: 'none', color: '#000', fontSize: '14px' }} />
                <button style={{ background: '#000', border: 'none', padding: '0 15px', cursor: 'pointer', color: '#fff' }}>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '40px', paddingTop: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
            &copy; {new Date().getFullYear()} Life Awakening Program Daund. All rights reserved.
          </div>

        </div>
      </footer>

      {/* Bottom to Top Button */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 1000 }}>
        <ArrowUp size={20} />
      </button>

    </div>
  )
}
