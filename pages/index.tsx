import { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import { supabase, SnackItem, VoteSession } from '../lib/supabase'
import { getVoterFingerprint } from '../lib/fingerprint'
import styles from '../styles/app.module.css'

const STORE_STYLE: Record<string, { bg: string; color: string }> = {
  全聯: { bg: '#E1F5EE', color: '#0F6E56' },
  
  
  
  
  其他: { bg: '#F1EFE8', color: '#5F5E5A' },
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'snackadmin'

export default function Home() {
  const [tab, setTab] = useState<'vote' | 'results' | 'add' | 'admin'>('vote')
  const [session, setSession] = useState<VoteSession | null>(null)
  const [items, setItems] = useState<SnackItem[]>([])
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'snack' | 'drink'>('all')
  const [toast, setToast] = useState('')
  const [fp, setFp] = useState('')
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPw, setAdminPw] = useState('')

  // Add form state
  const [urlInput, setUrlInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [preview, setPreview] = useState<Partial<SnackItem> | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formType, setFormType] = useState<'snack' | 'drink'>('snack')
  const [formStore, setFormStore] = useState('全聯')
  const [submitting, setSubmitting] = useState(false)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  // Init fingerprint & load data
  useEffect(() => {
    setFp(getVoterFingerprint())
    loadSession()
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return
    const ch = supabase
      .channel('snack-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snack_items' }, () => loadItems(session.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => loadItems(session.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_sessions' }, () => loadSession())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.id])

  async function loadSession() {
    const { data } = await supabase
      .from('vote_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) {
      setSession(data)
      loadItems(data.id)
      loadMyVotes(data.id)
    }
  }

  async function loadItems(sessionId: string) {
    const { data } = await supabase
      .from('snack_vote_counts')
      .select('*')
      .eq('session_id', sessionId)
      .order('vote_count', { ascending: false })
    if (data) setItems(data as SnackItem[])
  }

  async function loadMyVotes(sessionId: string) {
    const fingerprint = getVoterFingerprint()
    const { data } = await supabase
      .from('votes')
      .select('snack_id')
      .eq('session_id', sessionId)
      .eq('voter_fingerprint', fingerprint)
    if (data) setMyVotes(new Set(data.map((v: any) => v.snack_id)))
  }

  async function toggleVote(item: SnackItem) {
    if (!session?.is_open) return showToast('投票尚未開放')
    const fingerprint = getVoterFingerprint()
    if (myVotes.has(item.id)) {
      await supabase.from('votes').delete()
        .eq('snack_id', item.id)
        .eq('voter_fingerprint', fingerprint)
      setMyVotes(prev => { const s = new Set(prev); s.delete(item.id); return s })
      showToast('已取消投票')
    } else {
      const { error } = await supabase.from('votes').insert({
        session_id: session.id,
        snack_id: item.id,
        voter_fingerprint: fingerprint,
      })
      if (!error) {
        setMyVotes(prev => new Set(prev).add(item.id))
        showToast('投票成功！')
      }
    }
    loadItems(session.id)
  }

  async function fetchProduct() {
    if (!urlInput.trim()) return showToast('請貼上商品網址')
    setFetching(true)
    try {
      const res = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || '抓取失敗，請手動填寫'); showManual(); return }
      setPreview(data)
      setFormName(data.name || '')
      setFormPrice(data.price ? String(data.price) : '')
      setFormStore(data.store || '其他')
      showToast('商品資料已帶入，請確認後加入')
    } finally {
      setFetching(false)
    }
  }

  function showManual() {
    setPreview({ url: urlInput || '', image_url: null })
    setFormName('')
    setFormPrice('')
    setFormType('snack')
    setFormStore('全聯')
  }

  async function submitItem() {
    if (!formName.trim()) return showToast('請填寫商品名稱')
    if (!session) return showToast('目前沒有進行中的票選週期')
    setSubmitting(true)
    const { error } = await supabase.from('snack_items').insert({
      session_id: session.id,
      name: formName.trim(),
      price: formPrice ? parseInt(formPrice) : null,
      store: formStore,
      url: preview?.url || urlInput || null,
      image_url: preview?.image_url || null,
      type: formType,
    })
    setSubmitting(false)
    if (error) return showToast('新增失敗：' + error.message)
    setPreview(null)
    setUrlInput('')
    setFormName('')
    setFormPrice('')
    showToast('已加入候選！')
    setTab('vote')
  }

  // Admin functions
  async function createSession() {
    const title = prompt('票選標題', '本週零食票選') || '本週零食票選'
    await supabase.from('vote_sessions').insert({ title, is_open: true })
    loadSession()
    showToast('新票選週期已建立')
  }

  async function toggleSession() {
    if (!session) return
    await supabase.from('vote_sessions').update({
      is_open: !session.is_open,
      closed_at: !session.is_open ? null : new Date().toISOString(),
    }).eq('id', session.id)
    loadSession()
  }

  async function deleteItem(id: string) {
    if (!confirm('確定刪除此品項？')) return
    await supabase.from('snack_items').delete().eq('id', id)
    if (session) loadItems(session.id)
  }

  const filtered = items.filter(i => filter === 'all' || i.type === filter)
  const maxVotes = Math.max(...items.map(i => i.vote_count), 1)
  const totalVotes = items.reduce((a, i) => a + i.vote_count, 0)
  const budget = items.slice(0, 20).reduce((a, i) => a + (i.price || 0), 0)

  return (
    <>
      <Head>
        <title>零食採購票選</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.main}>
        {toast && <div className={styles.toast}>{toast}</div>}

        <div className={styles.topbar}>
          <div>
            <div className={styles.title}>
              {session?.title || '零食採購票選'}
            </div>
            <div className={styles.subtitle}>匿名投票・結果即時公開</div>
          </div>
          <span className={styles.pill} style={{
            background: session?.is_open ? '#EAF3DE' : '#FAEEDA',
            color: session?.is_open ? '#3B6D11' : '#854F0B',
          }}>
            {session?.is_open ? '投票開放中' : '投票未開放'}
          </span>
        </div>

        <div className={styles.tabs}>
          {(['vote', 'results', 'add', 'admin'] as const).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'vote' && '投票'}
              {t === 'results' && '結果'}
              {t === 'add' && '新增品項'}
              {t === 'admin' && '管理'}
            </button>
          ))}
        </div>

        {/* ── VOTE TAB ── */}
        {tab === 'vote' && (
          <>
            <div className={styles.statsRow}>
              <div className={styles.stat}><div className={styles.statNum}>{items.length}</div><div className={styles.statLbl}>候選品項</div></div>
              <div className={styles.stat}><div className={styles.statNum}>{totalVotes}</div><div className={styles.statLbl}>累計票數</div></div>
              <div className={styles.stat}><div className={styles.statNum}>{myVotes.size}</div><div className={styles.statLbl}>我的投票</div></div>
            </div>
            <div className={styles.filterRow}>
              {(['all', 'snack', 'drink'] as const).map(f => (
                <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? '全部' : f === 'snack' ? '零食' : '飲料'}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                尚無品項，{' '}
                <button className={styles.linkBtn} onClick={() => setTab('add')}>新增第一個</button>
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map(item => {
                  const voted = myVotes.has(item.id)
                  const sc = STORE_STYLE[item.store || '其他'] || STORE_STYLE['其他']
                  return (
                    <div key={item.id} className={`${styles.card} ${voted ? styles.voted : ''}`}>
                      <div className={styles.cardImg}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          : <span>{item.type === 'drink' ? '🥤' : '🍿'}</span>}
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardName}>{item.name}</div>
                        <div className={styles.cardPrice}>NT${item.price ?? '—'}</div>
                        <div className={styles.cardMeta}>
                          <span className={styles.storeTag} style={{ background: sc.bg, color: sc.color }}>{item.store}</span>
                          <span className={styles.typeTag} style={{
                            background: item.type === 'drink' ? '#E1F5EE' : '#FAEEDA',
                            color: item.type === 'drink' ? '#0F6E56' : '#854F0B',
                          }}>{item.type === 'drink' ? '飲料' : '零食'}</span>
                        </div>
                        <div className={styles.barRow}>
                          <div className={styles.barWrap}>
                            <div className={styles.bar} style={{ width: `${Math.round(item.vote_count / maxVotes * 100)}%` }} />
                          </div>
                          <span className={styles.barLabel}>{item.vote_count} 票</span>
                        </div>
                        <button
                          className={`${styles.voteBtn} ${voted ? styles.voteBtnActive : ''}`}
                          onClick={() => toggleVote(item)}
                          disabled={!session?.is_open}
                        >
                          {voted ? '✓ 已投票（點選取消）' : '投票支持'}
                        </button>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                            前往 {item.store} 查看 →
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === 'results' && (
          <>
            <div className={styles.statsRow}>
              <div className={styles.stat}><div className={styles.statNum}>{items.length}</div><div className={styles.statLbl}>候選品項</div></div>
              <div className={styles.stat}><div className={styles.statNum}>{totalVotes}</div><div className={styles.statLbl}>累計票數</div></div>
              <div className={styles.stat}><div className={styles.statNum}>NT${budget}</div><div className={styles.statLbl}>前20名預算估計</div></div>
            </div>
            <div className={styles.sectionLabel}>得票排名（即時・公開）</div>
            {[...items].sort((a, b) => b.vote_count - a.vote_count).map((item, i) => {
              const sc = STORE_STYLE[item.store || '其他'] || STORE_STYLE['其他']
              const pct = Math.round(item.vote_count / maxVotes * 100)
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
              const barColor = i === 0 ? '#BA7517' : i === 1 ? '#5F5E5A' : i === 2 ? '#1D9E75' : '#B4B2A9'
              return (
                <div key={item.id} className={styles.resultRow}>
                  <div className={styles.rankNum}>{medal}</div>
                  <div className={styles.resultThumb}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <span>{item.type === 'drink' ? '🥤' : '🍿'}</span>}
                  </div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{item.name}</div>
                    <div className={styles.resultSub}>
                      <span className={styles.storeTag} style={{ background: sc.bg, color: sc.color, fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>{item.store}</span>
                      <span style={{ marginLeft: 6, color: 'var(--color-text-tertiary)', fontSize: 12 }}>NT${item.price ?? '—'}</span>
                    </div>
                    <div className={styles.resultBarWrap}>
                      <div className={styles.resultBar} style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                  <div className={styles.resultRight}>
                    <div className={styles.resultVotes}>{item.vote_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>票</div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.buyLink}>
                        前往下單 →
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── ADD TAB ── */}
        {tab === 'add' && (
          <>
            <div className={styles.sectionLabel}>貼上賣場商品連結，自動帶入資料</div>
            <div className={styles.addBox}>
              <div className={styles.urlRow}>
                <input
                  type="text"
                  placeholder="貼上全聯 / 家樂福 / momo / 蝦皮 商品網址…"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchProduct()}
                  className={styles.urlInput}
                />
                <button className={styles.fetchBtn} onClick={fetchProduct} disabled={fetching}>
                  {fetching ? '讀取中…' : '自動帶入'}
                </button>
              </div>
              <div className={styles.hint}>貼上全聯商品網址自動帶入；其他賣場請手動填寫</div>
              {!preview && (
                <button className={styles.manualBtn} onClick={showManual}>手動填寫</button>
              )}
              {preview && (
                <div className={styles.previewCard}>
                  <div className={styles.previewImg}>
                    {preview.image_url
                      ? <img src={preview.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 32 }}>🛒</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.formLabel}>商品名稱 *</div>
                        <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="商品名稱" />
                      </div>
                      <div>
                        <div className={styles.formLabel}>單價（元）</div>
                        <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <div className={styles.formLabel}>類型</div>
                        <select value={formType} onChange={e => setFormType(e.target.value as any)}>
                          <option value="snack">零食</option>
                          <option value="drink">飲料</option>
                        </select>
                      </div>
                      <div>
                        <div className={styles.formLabel}>賣場</div>
                        <select value={formStore} onChange={e => setFormStore(e.target.value)}>
                          <option>全聯</option>
                        <option>其他</option>
                        </select>
                      </div>
                    </div>
                    <button className={styles.confirmBtn} onClick={submitItem} disabled={submitting}>
                      {submitting ? '新增中…' : '✓ 加入候選'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ADMIN TAB ── */}
        {tab === 'admin' && (
          <>
            {!adminUnlocked ? (
              <div className={styles.addBox}>
                <div className={styles.sectionLabel}>管理員驗證</div>
                <div className={styles.urlRow}>
                  <input type="password" placeholder="請輸入管理密碼" value={adminPw} onChange={e => setAdminPw(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && adminPw === ADMIN_PASSWORD) setAdminUnlocked(true) }} />
                  <button className={styles.fetchBtn} onClick={() => {
                    if (adminPw === ADMIN_PASSWORD) setAdminUnlocked(true)
                    else showToast('密碼錯誤')
                  }}>確認</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.adminActions}>
                  <button className={styles.actionBtn} onClick={createSession}>＋ 建立新週期</button>
                  {session && (
                    <button className={styles.actionBtn} onClick={toggleSession}>
                      {session.is_open ? '⏸ 關閉投票' : '▶ 開放投票'}
                    </button>
                  )}
                </div>
                {session && (
                  <div className={styles.sessionInfo}>
                    目前週期：<strong>{session.title}</strong>
                    <span className={styles.pill} style={{
                      marginLeft: 8, fontSize: 11,
                      background: session.is_open ? '#EAF3DE' : '#FAEEDA',
                      color: session.is_open ? '#3B6D11' : '#854F0B',
                    }}>
                      {session.is_open ? '開放中' : '已關閉'}
                    </span>
                  </div>
                )}
                <div className={styles.sectionLabel} style={{ marginTop: '1rem' }}>品項管理</div>
                {items.map(item => (
                  <div key={item.id} className={styles.adminRow}>
                    <div style={{ fontSize: 20 }}>{item.type === 'drink' ? '🥤' : '🍿'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.vote_count} 票 · NT${item.price ?? '—'} · {item.store}</div>
                    </div>
                    <button className={styles.delBtn} onClick={() => deleteItem(item.id)}>刪除</button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
