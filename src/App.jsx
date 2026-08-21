import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Apple, Archive, ArrowLeftRight, BarChart3, Bath, Beef, CalendarClock, Check, ChevronRight, CircleDollarSign, ClipboardCopy, Cloud, CloudOff, Coffee, CupSoda, Eye, EyeOff, GitMerge, LayoutGrid, List, ListChecks, LogIn, LogOut, Milk, Package, PackageCheck, PackagePlus, PackageSearch, Pencil, Plus, ReceiptText, Search, Settings, Share2, ShoppingBasket, SprayCan, Store, Tags, Trash2, TrendingUp, X } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth, firebaseReady, loginWithGoogle } from './firebase'
import { CATEGORIES, RECEIPT_PROMPT, UNITS, dateTimeLocal, defaultUnitForProduct, money, normalizeImport, normalizeText, normalizedPrice, nowIso, onlyDigits, parseJsonInput, shortDate, uid } from './data'
import { Empty, Field, Modal, Toast } from './components'
import { useStore } from './store'

const NAV = [
  ['lists', 'Lista', ListChecks], ['purchases', 'Compras', ReceiptText], ['prices', 'Analytics', BarChart3], ['products', 'Produtos', PackageSearch], ['settings', 'Ajustes', Settings],
]

const PERIODICITY_OPTIONS = [
  { value: 'auto', label: 'Automática' },
  { value: '7', label: 'Semanal' },
  { value: '14', label: 'A cada 2 semanas' },
  { value: '30', label: 'Mensal' },
  { value: '60', label: 'A cada 2 meses' },
  { value: '90', label: 'A cada 3 meses' },
  { value: '0', label: 'Só quando eu quiser' },
]

const ANALYTICS_PERIODS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 3 meses' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último ano' },
  { value: 'all', label: 'Todo o histórico' },
]

export default function App({ user }) {
  const { state, mutate, syncStatus } = useStore()
  const [tab, setTab] = useState('lists')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const pendingListCount = state.lists[0]?.items.filter((item) => !item.checked).length || 0

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast])

  const finishPurchase = (draft) => {
    const marketId = findOrCreateMarketId(state.markets, draft.market)
    const market = { id: marketId, ...draft.market, name: draft.market.name || 'Mercado não identificado' }
    const total = draft.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
    const purchasedAt = draft.purchasedAt || nowIso()
    mutate((current) => {
      const marketExists = current.markets.some((item) => item.id === marketId)
      const catalog = mergeProducts(current.products, draft.items, { purchasedAt, marketName: market.name })
      const purchase = { id: uid(), marketId, marketName: market.name, purchasedAt, documentNumber: draft.documentNumber || '', total, items: catalog.items, source: draft.source || 'manual' }
      const products = catalog.products
      const productMappings = updateProductMappings(current.productMappings, draft.items, catalog.items)
      return { ...current, purchases: [purchase, ...current.purchases], markets: marketExists ? current.markets.map((item) => item.id === marketId ? { ...item, ...market } : item) : [market, ...current.markets], products, productMappings }
    })
    setModal(null); setTab('purchases'); setToast('Compra registrada e preços atualizados.')
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand"><span className="brand-mark"><ShoppingBasket size={22} /></span><div><strong>Meu Mercado</strong><small>compre melhor, compare sempre</small></div></div>
        <span className={`sync-pill ${syncStatus}`} title="Situação da sincronização">{syncStatus === 'synced' ? <Cloud size={14}/> : <CloudOff size={14}/>}<span>{syncStatus === 'synced' ? 'Sincronizado' : firebaseReady ? 'Local' : 'Modo local'}</span></span>
      </div>
    </header>

    <main className="content">
      {tab === 'lists' && <ShoppingListPage state={state} mutate={mutate} open={setModal} />}
      {tab === 'purchases' && <PurchasesPage state={state} open={setModal} />}
      {tab === 'prices' && <AnalyticsPage state={state} />}
      {tab === 'products' && <ProductsPage state={state} mutate={mutate} open={setModal} />}
      {tab === 'settings' && <SettingsPage state={state} user={user} open={setModal} toast={setToast} />}
    </main>

    <nav className="bottom-nav">{NAV.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span className="nav-icon"><Icon size={21}/>{id === 'lists' && pendingListCount > 0 && <span className="nav-badge" aria-label={`${pendingListCount} itens para comprar`}>{pendingListCount > 99 ? '99+' : pendingListCount}</span>}</span><span>{label}</span></button>)}</nav>

    {modal?.type === 'item' && <ItemPanel item={modal.item} state={state} onClose={() => setModal(null)} onEditProduct={(product) => setModal({ type: 'product', product })} onDelete={() => {
      mutate((s) => ({ ...s, lists: s.lists.map((list) => ({ ...list, items: list.items.filter((item) => item.id !== modal.item.id) })) }))
      setModal(null); setToast('Item removido da lista.')
    }} onSave={(item) => {
      mutate((s) => ({
        ...s,
        lists: s.lists.map((list) => ({ ...list, items: list.items.map((old) => old.id === item.id ? item : old) })),
      }))
      setModal(null); setToast('Item atualizado nesta lista.')
    }} />}
    {modal?.type === 'product' && <ProductPanel product={modal.product} state={state} onClose={() => setModal(null)} onSave={(product) => {
      mutate((current) => updateCatalogProduct(current, modal.product, product))
      setModal(null); setToast('Produto atualizado no catálogo.')
    }} />}
    {modal?.type === 'merge-products' && <ProductMergeModal initialLeft={modal.products[0]} initialRight={modal.products[1]} onClose={() => setModal(null)} onMerge={(plan) => { mutate((current) => mergeCatalogProducts(current, plan)); setModal(null); setToast('Produtos normalizados e histórico atualizado.') }} />}
    {modal?.type === 'import' && <ImportModal toast={setToast} onClose={() => setModal(null)} onReview={(draft) => setModal({ type: 'review', draft: prepareDraftProductMatches({ ...draft, source: 'json' }, state.products, state.productMappings) })} />}
    {modal?.type === 'manual' && <ManualPurchaseModal markets={state.markets} onClose={() => setModal(null)} onReview={(draft) => setModal({ type: 'review', draft: prepareDraftProductMatches({ ...draft, source: 'manual' }, state.products, state.productMappings) })} />}
    {modal?.type === 'review' && <ReviewModal draft={modal.draft} products={state.products} onClose={() => setModal(null)} onSave={finishPurchase} />}
    {modal?.type === 'purchase-detail' && <PurchaseDetail purchase={modal.purchase} market={state.markets.find((market) => market.id === modal.purchase.marketId)} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'edit-purchase', purchase: modal.purchase, market: state.markets.find((market) => market.id === modal.purchase.marketId) })} onDelete={() => setModal({ type: 'delete-purchase', purchase: modal.purchase })} />}
    {modal?.type === 'edit-purchase' && <EditPurchaseModal purchase={modal.purchase} market={modal.market} onClose={() => setModal(null)} onSave={({ market, purchasedAt }) => { mutate((current) => updatePurchaseDetails(current, modal.purchase, market, purchasedAt)); setModal(null); setToast('Compra atualizada e histórico recalculado.') }} />}
    {modal?.type === 'delete-purchase' && <DeletePurchaseModal purchase={modal.purchase} onClose={() => setModal({ type: 'purchase-detail', purchase: modal.purchase })} onConfirm={() => { mutate((current) => removePurchase(current, modal.purchase.id)); setModal(null); setToast('Compra removida e histórico atualizado.') }} />}
    {modal?.type === 'share-list' && <ShareListModal list={state.lists[0]} onClose={() => setModal(null)} toast={setToast} />}
    {modal?.type === 'prompt' && <PromptModal onClose={() => setModal(null)} toast={setToast} />}
    <Toast message={toast} onClose={() => setToast('')} />
  </div>
}

function PageHeader({ title, action }) { return <div className="page-header"><div><h1>{title}</h1></div>{action}</div> }

const CATEGORY_ICONS = { Hortifruti: Apple, Mercearia: Coffee, Frios: Milk, Carnes: Beef, Bebidas: CupSoda, Limpeza: SprayCan, Higiene: Bath, Outros: Package }
function CategoryIcon({ category, size = 20 }) { const Icon = CATEGORY_ICONS[category] || Package; return <span className={`category-icon category-${categoryKey(category)}`}><Icon size={size}/></span> }

function ShoppingListPage({ state, mutate, open }) {
  const list = state.lists[0]
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('shopping-list-view') || 'list')
  const [groupByCategory, setGroupByCategory] = useState(() => localStorage.getItem('shopping-list-grouped') === 'true')
  const [showItemEstimates, setShowItemEstimates] = useState(() => localStorage.getItem('shopping-list-item-estimates') === 'true')
  useEffect(() => localStorage.setItem('shopping-list-view', viewMode), [viewMode])
  useEffect(() => localStorage.setItem('shopping-list-grouped', String(groupByCategory)), [groupByCategory])
  useEffect(() => localStorage.setItem('shopping-list-item-estimates', String(showItemEstimates)), [showItemEstimates])
  const addProduct = (product) => mutate((s) => {
    const productKey = normalizeText(product.name)
    const existsInCatalog = s.products.some((saved) => normalizeText(saved.name) === productKey)
    return {
      ...s,
      products: existsInCatalog
        ? s.products.map((saved) => normalizeText(saved.name) === productKey ? { ...saved, archivedAt: null } : saved)
        : [...s.products, { ...product, archivedAt: null }],
      lists: s.lists.map((current) => ({ ...current, items: [...current.items, productToListItem(product)] })),
    }
  })
  const toggleCompleted = (itemId) => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item) })) }))
  const renderItem = (item) => <ShoppingListItem key={item.id} item={item} estimatedPrice={showItemEstimates ? estimatedPriceForListItem(state, item) : null} showEstimate={showItemEstimates} onToggle={() => toggleCompleted(item.id)} onOpenEdit={() => open({ type: 'item', item })}/>
  const pendingItems = list.items.filter((item) => !item.checked)
  const completedItems = list.items.filter((item) => item.checked)
  const estimate = useMemo(() => estimateShoppingList(state, list), [state, list])
  const groups = CATEGORIES.map((category) => ({ category, items: pendingItems.filter((item) => category === 'Outros' ? !CATEGORIES.includes(item.category || 'Outros') || (item.category || 'Outros') === 'Outros' : item.category === category) }))
    .filter((group) => group.items.length)
  const clearCompleted = () => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.filter((item) => !item.checked) })) }))
  return <><PageHeader title="Lista de mercado"/>
    <div className="shopping-list-search-controls"><InlineProductSearch products={state.products} list={list} state={state} onAdd={addProduct}/></div>
    <div className="toolbar shopping-list-toolbar"><span className="list-count">{list.items.length} {list.items.length === 1 ? 'item' : 'itens'}</span><div className="list-view-actions">{list.items.length > 0 && <button className="share-list-button" aria-label="Compartilhar lista" title="Compartilhar lista" onClick={() => open({ type: 'share-list' })}><Share2 size={16}/><span>Compartilhar</span></button>}<button className={`group-toggle ${groupByCategory ? 'active' : ''}`} aria-label="Agrupar por categoria" title="Agrupar por categoria" aria-pressed={groupByCategory} onClick={() => setGroupByCategory((current) => !current)}><Tags size={16}/><span>Agrupar por categoria</span></button><div className="view-toggle" aria-label="Modo de visualização"><button className={viewMode === 'list' ? 'active' : ''} title="Visualizar em lista" aria-label="Visualizar em lista" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={18}/></button><button className={viewMode === 'grid' ? 'active' : ''} title="Visualizar em grade" aria-label="Visualizar em grade" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={18}/></button></div></div></div>
    {list.items.length > 0 && <section className={`shopping-estimate ${estimate.pricedCount ? '' : 'empty'}`} aria-label="Estimativa do valor da compra">
      <span className="shopping-estimate-icon"><CircleDollarSign size={18}/></span>
      <div><small>Total estimado da compra</small><strong>{estimate.pricedCount ? money(estimate.total) : 'Sem estimativa'}</strong></div>
      <p>{estimate.pricedCount ? <>Com base no último preço de {estimate.pricedCount} {estimate.pricedCount === 1 ? 'item' : 'itens'}{estimate.missingCount ? ` · ${estimate.missingCount} sem histórico` : ''}</> : 'Registre uma compra para formar o histórico de preços.'}</p>
      <button type="button" className={showItemEstimates ? 'estimate-item-toggle active' : 'estimate-item-toggle'} aria-pressed={showItemEstimates} onClick={() => setShowItemEstimates((current) => !current)}>{showItemEstimates ? <EyeOff size={15}/> : <Eye size={15}/>}<span>{showItemEstimates ? 'Ocultar nos itens' : 'Valores nos itens'}</span></button>
    </section>}
    {list.items.length ? <div className="shopping-list-content">
      {pendingItems.length > 0 && (groupByCategory ? <div className="category-groups">{groups.map((group) => <section className={`category-group category-${categoryKey(group.category)}`} key={group.category}><header><CategoryIcon category={group.category} size={17}/><div><h2>{group.category}</h2><span>{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span></div></header><div className={`item-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>{group.items.map(renderItem)}</div></section>)}</div> : <div className={`item-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>{pendingItems.map(renderItem)}</div>)}
      {completedItems.length > 0 && <section className="completed-items-group"><header><div><h2>Concluídos</h2><span>{completedItems.length} {completedItems.length === 1 ? 'item' : 'itens'}</span></div><button className="clear-completed" onClick={clearCompleted}><Trash2 size={15}/> Limpar concluídos</button></header><div className={`item-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>{completedItems.map(renderItem)}</div></section>}
    </div> : <Empty icon={ShoppingBasket} title="Sua lista está vazia" text="Use a busca acima para adicionar o primeiro produto."/>}
  </>
}

function ShoppingListItem({ item, estimatedPrice, showEstimate, onToggle, onOpenEdit }) {
  const pressTimer = useRef(null)
  const pressStart = useRef(null)
  const longPressed = useRef(false)
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null }
  useEffect(() => clearPress, [])
  const startPress = (event) => {
    if (event.button !== 0 || event.target.closest('button,input')) return
    pressStart.current = { x: event.clientX, y: event.clientY }
    longPressed.current = false
    clearPress()
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      navigator.vibrate?.(18)
      onOpenEdit()
    }, 520)
  }
  const movePress = (event) => {
    if (!pressStart.current) return
    if (Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y) > 9) clearPress()
  }
  const finishPress = () => { clearPress(); pressStart.current = null }
  const openContextMenu = (event) => {
    event.preventDefault()
    clearPress()
    onOpenEdit()
  }
  const clickItem = (event) => {
    if (event.target.closest('button,input')) return
    if (longPressed.current) { longPressed.current = false; return }
    onToggle()
  }
  const keyDown = (event) => {
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') { event.preventDefault(); onOpenEdit() }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() }
  }
  const variantLabel = [item.variety, item.brand].filter(Boolean).join(' · ')
  return <article className={`item-row simple category-${categoryKey(item.category)} ${item.checked ? 'checked' : ''}`} tabIndex="0" aria-label={`${item.name}. ${item.checked ? 'Concluído' : 'Pendente'}. Toque para marcar; segure para editar.`} onClick={clickItem} onKeyDown={keyDown} onContextMenu={openContextMenu} onPointerDown={startPress} onPointerMove={movePress} onPointerUp={finishPress} onPointerCancel={finishPress}>
    <CategoryIcon category={item.category}/><div className="item-main"><b>{item.name}</b><small className="item-details">{[variantLabel, `${item.quantity} ${item.unit}`].filter(Boolean).join(' · ')}</small>{item.note && <small className="item-note">{item.note}</small>}{showEstimate && <em className={estimatedPrice == null ? 'no-history' : ''}>{estimatedPrice == null ? 'Sem preço no histórico' : `${money(estimatedPrice)} estimado`}</em>}</div>
  </article>
}

function PurchasesPage({ state, open }) { return <><PageHeader title="Compras" text="Cada compra alimenta seu histórico de preços." action={<div className="button-pair"><button className="secondary" onClick={() => open({ type: 'import' })}><ReceiptText size={18}/> Importar JSON</button><button className="primary" onClick={() => open({ type: 'manual' })}><Plus size={18}/> Manual</button></div>}/>
  {state.purchases.length ? <div className="purchase-list">{state.purchases.map((purchase) => <button className="purchase-card" key={purchase.id} onClick={() => open({ type: 'purchase-detail', purchase })}><span className="card-icon"><Store/></span><span className="grow"><b>{purchase.marketName}</b><small>{shortDate(purchase.purchasedAt)} · {purchase.items.length} itens</small></span><strong>{money(purchase.total)}</strong><ChevronRight/></button>)}</div> : <Empty icon={ReceiptText} title="Nenhuma compra registrada" text="Importe o JSON de uma nota ou registre sua compra manualmente."/>}</> }

function AnalyticsPage({ state }) {
  const [section, setSection] = useState(() => localStorage.getItem('analytics-section') || 'summary')
  const [period, setPeriod] = useState(() => localStorage.getItem('analytics-period') || '90')
  const [query, setQuery] = useState(() => localStorage.getItem('analytics-query') || '')
  useEffect(() => localStorage.setItem('analytics-section', section), [section])
  useEffect(() => localStorage.setItem('analytics-period', period), [period])
  useEffect(() => localStorage.setItem('analytics-query', query), [query])
  const filteredState = useMemo(() => ({ ...state, purchases: filterPurchasesByPeriod(state.purchases, period) }), [state, period])
  const rows = useMemo(() => priceRows(filteredState).filter((row) => normalizeText(`${row.name} ${row.variant}`).includes(normalizeText(query))), [filteredState, query])
  const analytics = useMemo(() => analyticsData(filteredState, state.purchases, period), [filteredState, state.purchases, period])
  const tabs = [
    ['summary', 'Resumo', TrendingUp],
    ['products', 'Produtos', PackageSearch],
    ['markets', 'Mercados', Store],
    ['categories', 'Categorias', Tags],
  ]

  return <>
    <PageHeader title="Analytics" text="Entenda seus gastos, compare preços e descubra onde seu dinheiro rende mais."/>
    <div className="analytics-controls"><div className="analytics-tabs" role="tablist" aria-label="Visões de analytics">{tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={17}/><span>{label}</span></button>)}</div><label className="analytics-period"><CalendarClock size={16}/><span>Período</span><select aria-label="Período dos indicadores" value={period} onChange={(event) => setPeriod(event.target.value)}>{ANALYTICS_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    {!state.purchases.length ? <Empty icon={BarChart3} title="Seus indicadores aparecerão aqui" text="Registre uma compra para começar a acompanhar gastos, preços, mercados e categorias."/> : !filteredState.purchases.length ? <Empty icon={CalendarClock} title="Nenhuma compra neste período" text="Selecione um intervalo maior para visualizar seus indicadores."/> : <>
      {section === 'summary' && <AnalyticsSummary analytics={analytics}/>}
      {section === 'products' && <><div className="analytics-section-heading"><div><h2>Comparativo de preços</h2><p>Valores normalizados por kg, litro ou unidade quando possível.</p></div><div className="search"><Search size={18}/><input placeholder="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)}/></div></div>
        {rows.length ? <div className="price-grid">{rows.map((row) => <article className={`price-card category-${categoryKey(row.category)}`} key={row.id}><div className="price-title"><CategoryIcon category={row.category}/><div><h3>{row.name}</h3>{row.variant && <small className="analytics-variant">{row.variant}</small>}<small className="price-context">{row.count} reg. · {shortDate(row.latestDate)} · {row.markets.length} {row.markets.length === 1 ? 'mercado' : 'mercados'}</small></div></div><div className="metrics"><div><small>Atual</small><b>{money(row.latest)}</b></div><div><small>Menor</small><b className="green">{money(row.min)}</b></div><div><small>Maior</small><b>{money(row.max)}</b></div></div>{row.unit && <span className="analytics-normalized">Melhor / {row.unit}: <b>{money(row.normalizedMin)}</b></span>}</article>)}</div> : <Empty icon={Search} title="Nenhum produto encontrado" text="Tente buscar por outro nome."/>}</>}
      {section === 'markets' && <MarketAnalytics rows={analytics.markets}/>}
      {section === 'categories' && <CategoryAnalytics rows={analytics.categories} total={analytics.totalSpent}/>}
    </>}
  </>
}

function AnalyticsSummary({ analytics }) {
  const maxPurchase = Math.max(...analytics.recentPurchases.map((purchase) => Number(purchase.total) || 0), 1)
  return <div className="analytics-dashboard">
    <div className="kpi-grid">
      <article className="kpi-card"><span className="kpi-icon green"><CircleDollarSign size={19}/></span><small>Total gasto</small><strong>{money(analytics.totalSpent)}</strong><p>{analytics.spendingComparison}</p></article>
      <article className="kpi-card"><span className="kpi-icon blue"><ReceiptText size={19}/></span><small>Ticket médio</small><strong>{money(analytics.averageTicket)}</strong><p>{analytics.purchaseCount} {analytics.purchaseCount === 1 ? 'compra registrada' : 'compras registradas'}</p></article>
      <article className="kpi-card"><span className="kpi-icon purple"><ShoppingBasket size={19}/></span><small>Itens por compra</small><strong>{formatNumber(analytics.itemsPerPurchase, 1)}</strong><p>{analytics.itemCount} {analytics.itemCount === 1 ? 'item no histórico' : 'itens no histórico'}</p></article>
      <article className="kpi-card"><span className="kpi-icon orange"><Store size={19}/></span><small>Mercados visitados</small><strong>{analytics.markets.length}</strong><p>{analytics.uniqueProducts} {analytics.uniqueProducts === 1 ? 'produto' : 'produtos'} · {analytics.uniqueVariants} {analytics.uniqueVariants === 1 ? 'variação' : 'variações'}</p></article>
    </div>
    <div className="analytics-panels">
      <section className="analytics-panel"><header><div><h2>Compras recentes</h2><p>Valor total de cada compra</p></div></header><div className="purchase-bars">{analytics.recentPurchases.map((purchase) => <div className="purchase-bar" key={purchase.id}><div><b>{purchase.marketName}</b><small>{shortDate(purchase.purchasedAt)}</small></div><span><i style={{ width: `${Math.max(5, Number(purchase.total || 0) / maxPurchase * 100)}%` }}/></span><strong>{money(purchase.total)}</strong></div>)}</div></section>
      <section className="analytics-panel"><header><div><h2>Destaques</h2><p>O que mais chama atenção no histórico</p></div></header><div className="insight-list">
        <div><span className="insight-icon"><Store size={18}/></span><p><small>Mercado com maior gasto</small><b>{analytics.markets[0]?.name || '—'}</b><em>{analytics.markets[0] ? money(analytics.markets[0].total) : 'Sem dados'}</em></p></div>
        <div><span className="insight-icon"><Tags size={18}/></span><p><small>Categoria com maior gasto</small><b>{analytics.categories[0]?.name || '—'}</b><em>{analytics.categories[0] ? money(analytics.categories[0].total) : 'Sem dados'}</em></p></div>
        <div><span className="insight-icon"><TrendingUp size={18}/></span><p><small>Maior variação de preço</small><b>{analytics.biggestVariation ? [analytics.biggestVariation.name, analytics.biggestVariation.variant].filter(Boolean).join(' · ') : 'Mais histórico necessário'}</b><em>{analytics.biggestVariation ? `${formatNumber(analytics.biggestVariation.variation, 0)}% entre menor e maior` : 'Compare após novas compras'}</em></p></div>
      </div></section>
    </div>
  </div>
}

function MarketAnalytics({ rows }) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1)
  return <div><div className="analytics-section-heading"><div><h2>Desempenho por mercado</h2><p>Compare frequência, gasto acumulado e ticket médio.</p></div></div><div className="ranking-list">{rows.map((row, index) => <article className="ranking-card" key={row.name}><span className="ranking-position">{index + 1}</span><span className="ranking-icon"><Store size={20}/></span><div className="ranking-main"><div><b>{row.name}</b><small>{row.count} {row.count === 1 ? 'compra' : 'compras'} · última em {shortDate(row.latestDate)}</small></div><span className="ranking-progress"><i style={{ width: `${row.total / maxTotal * 100}%` }}/></span></div><div className="ranking-values"><strong>{money(row.total)}</strong><small>média {money(row.average)}</small></div></article>)}</div></div>
}

function CategoryAnalytics({ rows, total }) {
  return <div><div className="analytics-section-heading"><div><h2>Gastos por categoria</h2><p>Veja quais grupos têm mais peso no seu orçamento.</p></div></div><div className="category-analytics-grid">{rows.map((row) => { const percentage = total ? row.total / total * 100 : 0; return <article className={`category-analytics-card category-${categoryKey(row.name)}`} key={row.name}><div className="category-analytics-title"><CategoryIcon category={row.name} size={20}/><div><b>{row.name}</b><small>{row.itemCount} {row.itemCount === 1 ? 'item comprado' : 'itens comprados'}</small></div><strong>{formatNumber(percentage, 0)}%</strong></div><div className="category-analytics-value"><strong>{money(row.total)}</strong><small>média de {money(row.averageItem)} por item</small></div><span className="category-progress"><i style={{ width: `${percentage}%` }}/></span></article> })}</div></div>
}

function ProductsPage({ state, mutate, open }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkPeriodicity, setBulkPeriodicity] = useState('30')
  const [productGrouping, setProductGrouping] = useState(() => {
    const saved = localStorage.getItem('products-grouping')
    return ['category', 'periodicity'].includes(saved) ? saved : localStorage.getItem('products-grouped') === 'true' ? 'category' : ''
  })
  useEffect(() => localStorage.setItem('products-grouping', productGrouping), [productGrouping])
  useEffect(() => setSelected((current) => current.filter((id) => state.products.some((product) => product.id === id && !product.archivedAt))), [state.products])
  const products = state.products
    .filter((p) => !p.archivedAt && normalizeText(`${p.name} ${(p.brands || []).join(' ')}`).includes(normalizeText(query)))
    .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }))
  const selectedSet = new Set(selected)
  const setProductPeriodicity = (ids, value) => mutate((current) => ({
    ...current,
    products: current.products.map((product) => ids.includes(product.id) ? { ...product, recurrenceDays: value === 'auto' ? null : Number(value) } : product),
  }))
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id])
  const archiveProduct = (id) => {
    mutate((current) => ({
      ...current,
      products: current.products.map((product) => product.id === id ? { ...product, archivedAt: nowIso() } : product),
    }))
    setSelected((current) => current.filter((saved) => saved !== id))
  }
  const allVisibleSelected = products.length > 0 && products.every((product) => selectedSet.has(product.id))
  const categoryGroups = CATEGORIES.map((category) => ({ key: category, label: category, category, products: products.filter((product) => category === 'Outros' ? !CATEGORIES.includes(product.category || 'Outros') || (product.category || 'Outros') === 'Outros' : product.category === category) }))
    .filter((group) => group.products.length)
  const knownPeriodicityValues = new Set(PERIODICITY_OPTIONS.map((option) => option.value))
  const periodicityGroups = [
    ...PERIODICITY_OPTIONS.map((option) => ({ key: option.value, label: option.label, products: products.filter((product) => (product.recurrenceDays == null ? 'auto' : String(product.recurrenceDays)) === option.value) })),
    ...[...new Set(products.map((product) => product.recurrenceDays == null ? 'auto' : String(product.recurrenceDays)).filter((value) => !knownPeriodicityValues.has(value)))].map((value) => ({ key: value, label: `A cada ${value} dias`, products: products.filter((product) => String(product.recurrenceDays) === value) })),
  ].filter((group) => group.products.length)
  const groups = productGrouping === 'category' ? categoryGroups : periodicityGroups
  const renderProduct = (product) => {
    const frequency = periodicityInfo(state, product)
    const variants = normalizeProductVariants(product.variants)
    return <article className={`product-card category-${categoryKey(product.category)} ${selectedSet.has(product.id) ? 'selected' : ''}`} key={product.id}>
      <div className="product-card-header">
        <button className="product-select" aria-label={`Selecionar ${product.name}`} aria-pressed={selectedSet.has(product.id)} onClick={() => toggle(product.id)}>{selectedSet.has(product.id) && <Check size={15}/>}</button>
        <CategoryIcon category={product.category} size={22}/>
        <div className="product-title"><b>{product.name}</b><small>{product.category} · {product.defaultUnit || defaultUnitForProduct(product.name, product.category)}</small></div>
        <div className="product-card-actions"><button className="icon-button edit-product" aria-label={`Editar ${product.name}`} title="Editar produto" onClick={() => open({ type: 'product', product })}><Pencil size={17}/></button><button className="icon-button archive-product" aria-label={`Arquivar ${product.name}`} title="Arquivar produto" onClick={() => archiveProduct(product.id)}><Archive size={17}/></button></div>
      </div>
      {variants.length > 0 && <div className="product-card-body"><div className="product-variant-badges" aria-label="Variações do produto">{variants.map((variant) => <span key={variant.id}>{[variant.variety, variant.brand, `${variant.packageSize} ${variant.packageUnit}`].filter(Boolean).join(' · ') || 'Variação padrão'}</span>)}</div></div>}
      <div className="product-card-footer"><span className="product-card-label"><CalendarClock size={14}/> Reposição</span><strong className="product-periodicity" title={product.recurrenceDays == null ? `Automática · ${frequency.label}` : frequency.label}>{compactPeriodicity(product, frequency)}</strong></div>
    </article>
  }
  return <>
    <PageHeader title="Produtos" text="A periodicidade automática usa seu histórico; você pode ajustar um item ou vários de uma vez."/>
    <div className="product-catalog-controls">
      <div className="catalog-tools">
        <div className="search"><Search size={18}/><input placeholder="Produto ou marca" value={query} onChange={(e) => setQuery(e.target.value)}/>{query && <button className="search-clear" aria-label="Limpar busca de produtos" title="Limpar busca" onClick={() => setQuery('')}><X size={17}/></button>}</div>
        <div className="catalog-actions"><button className={`group-toggle ${productGrouping === 'category' ? 'active' : ''}`} aria-label="Agrupar produtos por categoria" title="Agrupar por categoria" aria-pressed={productGrouping === 'category'} onClick={() => setProductGrouping((current) => current === 'category' ? '' : 'category')}><Tags size={16}/><span>Agrupar por categoria</span></button><button className={`group-toggle ${productGrouping === 'periodicity' ? 'active' : ''}`} aria-label="Agrupar produtos por periodicidade" title="Agrupar por periodicidade" aria-pressed={productGrouping === 'periodicity'} onClick={() => setProductGrouping((current) => current === 'periodicity' ? '' : 'periodicity')}><CalendarClock size={16}/><span>Agrupar por periodicidade</span></button><button className="ghost select-visible" aria-label={allVisibleSelected ? 'Desmarcar produtos visíveis' : 'Selecionar produtos visíveis'} title={allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'} onClick={() => setSelected(allVisibleSelected ? selected.filter((id) => !products.some((product) => product.id === id)) : [...new Set([...selected, ...products.map((product) => product.id)])])}><Check size={16}/><span>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</span></button></div>
      </div>
      {selected.length > 0 && <div className="bulk-periodicity"><div className="bulk-selection-label"><span><b>{selected.length}</b> selecionados</span><button className="clear-selection" aria-label="Limpar seleção" title="Limpar seleção" onClick={() => setSelected([])}><X size={18}/></button></div>{selected.length === 2 && <button className="secondary" onClick={() => open({ type: 'merge-products', products: selected.map((id) => state.products.find((product) => product.id === id)) })}><GitMerge size={16}/> Normalizar / fundir</button>}<select aria-label="Periodicidade para os produtos selecionados" value={bulkPeriodicity} onChange={(event) => setBulkPeriodicity(event.target.value)}>{PERIODICITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="primary" onClick={() => { setProductPeriodicity(selected, bulkPeriodicity); setSelected([]) }}>Aplicar ao grupo</button></div>}
    </div>
    {products.length ? (productGrouping ? <div className="category-groups product-category-groups">{groups.map((group) => <section className={`category-group ${group.category ? `category-${categoryKey(group.category)}` : 'periodicity-group'}`} key={group.key}><header>{group.category ? <CategoryIcon category={group.category} size={17}/> : <span className="category-icon periodicity-icon"><CalendarClock size={17}/></span>}<div><h2>{group.label}</h2><span>{group.products.length} {group.products.length === 1 ? 'produto' : 'produtos'}</span></div></header><div className="product-grid">{group.products.map(renderProduct)}</div></section>)}</div> : <div className="product-grid">{products.map(renderProduct)}</div>) : <Empty icon={PackageSearch} title="Nenhum produto visível" text="Produtos arquivados voltam automaticamente quando forem cadastrados ou importados novamente."/>}
  </>
}

function SettingsPage({ user, open, toast }) { return <><PageHeader title="Ajustes" text="Conta, importação e estado da sincronização."/><div className="settings-list"><section className="settings-card"><span className="card-icon">{user ? <Cloud/> : <LogIn/>}</span><div className="grow"><b>{user ? user.displayName : 'Conta Google'}</b><small>{user ? user.email : firebaseReady ? 'Entre para sincronizar entre dispositivos' : 'Firebase ainda não configurado; seus dados estão seguros neste dispositivo'}</small></div>{user ? <button className="secondary" onClick={() => signOut(auth)}><LogOut size={16}/> Sair</button> : <button className="primary" disabled={!firebaseReady} onClick={() => loginWithGoogle().catch((e) => toast(e.message))}>Entrar</button>}</section><button className="settings-card clickable" onClick={() => open({ type: 'prompt' })}><span className="card-icon"><ClipboardCopy/></span><div className="grow"><b>Prompt para leitura da nota</b><small>Copie o formato esperado e use na IA de sua preferência</small></div><ChevronRight/></button><section className="settings-card"><span className="card-icon"><CloudOff/></span><div><b>PWA e modo offline</b><small>A lista permanece disponível sem conexão. A sincronização ocorre ao voltar.</small></div></section></div></> }

function InlineProductSearch({ products, list, state, onAdd }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const included = new Set(list.items.map(listItemSelectionKey))
  const normalizedQuery = normalizeText(query)
  const activeProducts = products.filter((product) => !product.archivedAt)
  const results = normalizedQuery
    ? activeProducts.filter((product) => normalizeText(`${product.name} ${product.category} ${normalizeProductVariants(product.variants).map((variant) => `${variant.variety} ${variant.brand}`).join(' ')}`).includes(normalizedQuery)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10)
    : []
  const variantResults = normalizedQuery
    ? activeProducts.flatMap((product) => normalizeProductVariants(product.variants).filter((variant) => normalizeText(`${product.name} ${variant.variety} ${variant.brand} ${variant.packageSize} ${variant.packageUnit}`).includes(normalizedQuery)).map((variant) => ({ ...product, selectedVariant: variant }))).sort((a, b) => `${a.name} ${a.selectedVariant.variety} ${a.selectedVariant.brand}`.localeCompare(`${b.name} ${b.selectedVariant.variety} ${b.selectedVariant.brand}`, 'pt-BR')).slice(0, 14)
    : []
  const suggestionGroups = normalizedQuery ? [] : groupedProductSuggestions(state, list)
  const hasExactProduct = activeProducts.some((product) => normalizeText(product.name) === normalizedQuery)
  useEffect(() => {
    const closeOnOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])
  const add = (product) => {
    const selectionKey = productSelectionKey(product)
    if (included.has(selectionKey)) return
    onAdd(product)
    setQuery('')
    setOpen(true)
    inputRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }
  const addGroup = (productsToAdd) => {
    productsToAdd.forEach(add)
    setQuery('')
  }
  return <div className="inline-autocomplete" ref={containerRef}>
    <div className={`autocomplete-search ${open ? 'open' : ''}`}><Search size={20}/><input ref={inputRef} role="combobox" aria-controls="product-options" aria-expanded={open} placeholder="Adicionar produto..." value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && (results[0] || variantResults[0])) { event.preventDefault(); add(results[0] || variantResults[0]) } }}/><span className="search-hint">Digite para buscar</span></div>
    {open && <div className="autocomplete-popover" onPointerDown={(event) => { if (event.target.closest('button')) event.preventDefault() }}><div className="popover-heading"><b>{normalizedQuery ? 'Resultados' : 'Sugeridos para você'}</b><small>{normalizedQuery ? 'Produtos primeiro, variedades no final' : 'Organizados pela próxima compra'}</small></div><div className="autocomplete-results" id="product-options" role="listbox">
        {normalizedQuery ? results.map((product) => { const alreadyAdded = included.has(productSelectionKey(product)); return <SuggestionButton key={product.id} product={product} alreadyAdded={alreadyAdded} onAdd={add}/> }) : suggestionGroups.map((group) => <section className="suggestion-group" key={group.id}><header><div><b>{group.label}</b><small>{group.description}</small></div><button onClick={() => addGroup(group.products)}>Adicionar todos</button></header>{group.products.map((product) => <SuggestionButton key={product.id} product={product} alreadyAdded={included.has(productSelectionKey(product))} onAdd={add} meta={product.suggestionMeta}/>)}</section>)}
        {query.trim() && !hasExactProduct && <button className="custom-product category-outros" onClick={() => add({ id: uid(), name: query.trim(), category: 'Outros', defaultUnit: 'un', brands: [], variants: [] })}><CategoryIcon category="Outros"/><span className="grow"><span className="new-title"><b>Criar “{query.trim()}”</b><em>Novo</em></span><small>Novo produto · unidade</small></span><Plus size={19}/></button>}
        {normalizedQuery && variantResults.length > 0 && <div className="variant-results-heading"><b>Variedades</b><small>Selecione uma opção específica</small></div>}
        {normalizedQuery && variantResults.map((product) => <SuggestionButton key={`${product.id}-${product.selectedVariant.id}`} product={product} alreadyAdded={included.has(productSelectionKey(product))} onAdd={add} variant/>)}
        {!results.length && !query.trim() && !suggestionGroups.length && <p className="autocomplete-empty">Registre uma compra para começarmos a prever quando os produtos vão faltar.</p>}
      </div></div>}
  </div>
}

function SuggestionButton({ product, alreadyAdded = false, onAdd, meta, variant = false }) { const selected = product.selectedVariant; return <button className={`category-${categoryKey(product.category)} ${variant ? 'variant-result' : ''}`} role="option" aria-selected={alreadyAdded} disabled={alreadyAdded} onClick={() => onAdd(product)}><CategoryIcon category={product.category}/><span className="grow"><b>{variant ? [product.name, selected?.variety].filter(Boolean).join(' · ') : product.name}</b><small>{meta || (variant ? [selected?.brand, `${selected?.packageSize} ${selected?.packageUnit}`].filter(Boolean).join(' · ') : `${product.category} · ${product.defaultUnit || defaultUnitForProduct(product.name, product.category)}`)}</small></span>{alreadyAdded ? <span className="added-label"><Check size={15}/> Na lista</span> : <Plus size={19}/>}</button> }

function ItemPanel({ item: initial, state, onClose, onSave, onDelete, onEditProduct }) {
  const [item, setItem] = useState(initial)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const product = state.products.find((saved) => saved.id === initial.productId) || state.products.find((saved) => normalizeText(saved.name) === normalizeText(initial.name))
  const variants = normalizeProductVariants(product?.variants)
  const selectedVariant = variants.find((variant) => variant.id === item.variantId) || variants.find((variant) => variantMatchesItem(variant, item))
  const selectedVariantId = selectedVariant?.id || ''
  const priceHistory = priceHistoryForListItem(state, product, initial)
  const selectedVarietyKey = normalizeText(item.variety)
  const latestPrice = selectedVarietyKey ? priceHistory.find((entry) => entry.varietyKey === selectedVarietyKey) : priceHistory[0]
  const openPriceHistory = () => {
    setHistoryFilter(selectedVarietyKey || 'all')
    setShowPriceHistory(true)
  }
  const selectVariant = (variantId) => {
    const variant = variants.find((saved) => saved.id === variantId)
    setItem((current) => variant ? { ...current, variantId: variant.id, variety: variant.variety || '', brand: variant.brand || '', packageSize: variant.packageSize, packageUnit: variant.packageUnit } : { ...current, variantId: '', variety: '', brand: '', packageSize: '', packageUnit: '' })
  }
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...item, quantity: Math.max(0.1, Number(item.quantity) || 1), note: (item.note || '').trim() })
  }
  if (showPriceHistory) return <PriceHistoryPanel productName={item.name} entries={priceHistory} filter={historyFilter} selectedVarietyLabel={item.variety} onFilterChange={setHistoryFilter} onBack={() => setShowPriceHistory(false)} onClose={onClose}/>
  return <Modal title="Editar item da lista" subtitle="Quantidade e nota valem somente para esta lista." onClose={onClose}>
    <form onSubmit={submit}>
      <div className={`list-item-edit-heading category-${categoryKey(item.category)}`}><CategoryIcon category={item.category}/><div><b>{item.name}</b><small>{item.category} · {item.unit}</small></div></div>
      {product && <button type="button" className="secondary edit-catalog-product" onClick={() => onEditProduct(product)}><Pencil size={16}/> Editar produto no catálogo</button>}
      <Field label="Quantidade"><div className="quantity-field"><input autoFocus type="number" min="0.1" step="0.1" value={item.quantity} onChange={(event) => setItem({ ...item, quantity: event.target.value })}/><span>{item.unit}</span></div></Field>
      {variants.length > 0 && <Field label="Variação (opcional)"><select value={selectedVariantId} onChange={(event) => selectVariant(event.target.value)}><option value="">Nenhuma variação</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{[variant.variety || 'Variação padrão', variant.brand || 'Sem marca', `${variant.packageSize} ${variant.packageUnit}`].join(' · ')}</option>)}</select><small>Vale somente para este item da lista.</small></Field>}
      <div className={`item-latest-price ${latestPrice ? '' : 'empty'}`}>
        <span className="price-history-icon"><CircleDollarSign size={21}/></span>
        <div className="grow"><small>{selectedVarietyKey ? `Último preço · ${item.variety}` : 'Último preço · última variedade comprada'}</small>{latestPrice ? <><strong>{money(latestPrice.unitPrice)}</strong><em>{[latestPrice.item.variety, shortDate(latestPrice.purchase.purchasedAt), latestPrice.purchase.marketName].filter(Boolean).join(' · ')}</em></> : <strong>Nenhum preço registrado</strong>}</div>
        <button type="button" className="price-history-button" onClick={openPriceHistory} aria-label="Abrir histórico de preços" title="Histórico de preços"><CircleDollarSign size={19}/><span>Preços</span></button>
      </div>
      <Field label="Nota para esta lista (opcional)"><textarea rows="3" value={item.note || ''} onChange={(event) => setItem({ ...item, note: event.target.value })} placeholder="Ex.: comprar para o almoço de domingo"/><small>A nota será apagada quando o item sair da lista.</small></Field>
      <div className="modal-actions item-modal-actions"><button type="button" className="secondary danger item-delete-button" onClick={onDelete}><Trash2 size={17}/> Excluir da lista</button><span/><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary"><Check size={17}/> Salvar</button></div>
    </form>
  </Modal>
}

function PriceHistoryPanel({ productName, entries, filter, selectedVarietyLabel, onFilterChange, onBack, onClose }) {
  const varietyMap = new Map(entries.map((entry) => [entry.varietyKey, entry.item.variety || 'Sem variedade']))
  if (filter !== 'all' && !varietyMap.has(filter)) varietyMap.set(filter, selectedVarietyLabel || 'Sem variedade')
  const varieties = [...varietyMap.entries()]
  const filteredEntries = filter === 'all' ? entries : entries.filter((entry) => entry.varietyKey === filter)
  const average = filteredEntries.length ? filteredEntries.reduce((sum, entry) => sum + entry.unitPrice, 0) / filteredEntries.length : 0
  return <Modal title={`Preços de ${productName}`} subtitle="Média e compras registradas para este produto." onClose={onClose}>
    <button type="button" className="ghost price-history-back" onClick={onBack}><ChevronRight size={17}/> Voltar para a edição</button>
    <Field label="Filtrar por variedade"><select value={filter} onChange={(event) => onFilterChange(event.target.value)}><option value="all">Todas as variedades</option>{varieties.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <div className="price-history-summary"><div><small>Preço médio</small><strong>{filteredEntries.length ? money(average) : '—'}</strong><span>por item comprado</span></div><div><small>Registros</small><strong>{filteredEntries.length}</strong><span>{filteredEntries.length === 1 ? 'compra' : 'compras'}</span></div></div>
    {filteredEntries.length ? <div className="item-price-history-list">{filteredEntries.map((entry) => <article key={`${entry.purchase.id}-${entry.item.id}`}><span className="price-history-date"><b>{shortDate(entry.purchase.purchasedAt)}</b><small>{entry.purchase.marketName}</small></span><span className="price-history-variant"><b>{entry.item.variety || 'Sem variedade'}</b><small>{[entry.item.brand, `${Number(entry.item.packageSize) || 1} ${entry.item.packageUnit || 'un'}`].filter(Boolean).join(' · ')}</small></span><span className="price-history-value"><strong>{money(entry.unitPrice)}</strong>{Number(entry.item.quantity) !== 1 && <small>{entry.item.quantity} itens · total {money(entry.item.totalPrice)}</small>}</span></article>)}</div> : <Empty icon={CircleDollarSign} title="Nenhum preço nesta variedade" text="Escolha outra variedade ou registre uma nova compra."/>}
  </Modal>
}

function ProductPanel({ product: initial, state, onClose, onSave }) {
  const [product, setProduct] = useState({ ...initial, variants: normalizeProductVariants(initial.variants) })
  const history = purchaseHistoryFor(state, initial.name)
  const recurrenceValue = product.recurrenceDays == null ? 'auto' : String(product.recurrenceDays)
  const customRecurrence = PERIODICITY_OPTIONS.every((option) => option.value !== recurrenceValue)
  const updateVariant = (id, patch) => setProduct((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === id ? { ...variant, ...patch } : variant) }))
  const removeVariant = (id) => setProduct((current) => ({ ...current, variants: current.variants.filter((variant) => variant.id !== id) }))
  const addVariant = () => setProduct((current) => ({ ...current, variants: [...current.variants, { id: uid(), variety: '', brand: '', packageSize: 1, packageUnit: 'un', barcode: '', createdAt: nowIso() }] }))
  const submit = (event) => {
    event.preventDefault()
    if (!product.name.trim()) return
    onSave({
      ...product,
      name: product.name.trim(),
      category: product.category || 'Outros',
      defaultUnit: product.defaultUnit || defaultUnitForProduct(product.name, product.category),
      variants: product.variants.map((variant) => ({ ...variant, brand: (variant.brand || '').trim(), packageSize: Math.max(0.001, Number(variant.packageSize) || 1) })),
      brands: [...new Set(product.variants.map((variant) => (variant.brand || '').trim()).filter(Boolean))],
    })
  }
  return <Modal title="Editar produto" subtitle="As alterações valem para o catálogo, sugestões e futuras listas." onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="item-edit-primary">
        <Field label="Produto"><input autoFocus required value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} placeholder="Ex.: Arroz"/></Field>
        <div className="form-grid"><Field label="Categoria"><select value={product.category || 'Outros'} onChange={(event) => setProduct({ ...product, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Unidade padrão"><select value={product.defaultUnit || 'un'} onChange={(event) => setProduct({ ...product, defaultUnit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field></div>
      </div>

      <details className="item-edit-section" open>
        <summary><span><b>Reposição</b><small>Quando o produto deve voltar às sugestões</small></span><ChevronRight size={18}/></summary>
        <div className="item-edit-section-body"><Field label="Periodicidade"><select value={recurrenceValue} onChange={(event) => setProduct({ ...product, recurrenceDays: event.target.value === 'auto' ? null : Number(event.target.value) })}>{PERIODICITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}{customRecurrence && <option value={recurrenceValue}>A cada {recurrenceValue} dias</option>}</select></Field></div>
      </details>

      <section className="variant-editor-section"><div className="variant-editor-heading"><div><b>Variações de compra</b><small>Cada variação combina sabor/tipo, marca e embalagem.</small></div><button type="button" className="secondary" onClick={addVariant}><Plus size={16}/> Adicionar</button></div>{product.variants.length ? <div className="variant-editor-list">{product.variants.map((variant) => { const variantHistory = purchaseHistoryForVariant(state, initial, variant); const latest = variantHistory[0]; return <article className="variant-editor-card" key={variant.id}><div className="variant-editor-card-heading"><div><b>{[variant.variety, variant.brand].filter(Boolean).join(' · ') || 'Variação padrão'}</b><small>{variant.packageSize} {variant.packageUnit}{latest ? ` · última compra ${shortDate(latest.purchase.purchasedAt)}` : ''}</small></div><button type="button" className="icon-button danger" aria-label="Remover variação" title="Remover variação" onClick={() => removeVariant(variant.id)}><Trash2 size={16}/></button></div><div className="variant-fields"><Field label="Sabor / tipo"><input value={variant.variety || ''} onChange={(event) => updateVariant(variant.id, { variety: event.target.value })} placeholder="Ex.: Tradicional, Amargo, Integral"/></Field><Field label="Marca"><input value={variant.brand || ''} onChange={(event) => updateVariant(variant.id, { brand: event.target.value })} placeholder="Sem marca"/></Field><Field label="Embalagem"><div className="joined"><input type="number" min="0.001" step="0.001" value={variant.packageSize} onChange={(event) => updateVariant(variant.id, { packageSize: event.target.value })}/><select value={variant.packageUnit} onChange={(event) => updateVariant(variant.id, { packageUnit: event.target.value })}>{['un','kg','g','L','ml'].map((unit) => <option key={unit}>{unit}</option>)}</select></div></Field></div>{latest && <div className="variant-latest"><span>{variantHistory.length} {variantHistory.length === 1 ? 'compra' : 'compras'} no histórico</span><strong>Último preço: {money(latest.item.unitPrice || latest.item.totalPrice / (Number(latest.item.quantity) || 1))}</strong></div>}</article> })}</div> : <p className="variant-empty">Nenhuma variação registrada ainda. Elas aparecerão aqui depois da primeira compra.</p>}</section>

      <details className="item-edit-section history-section">
        <summary><span><b>Histórico de compras</b><small>{history.length} {history.length === 1 ? 'registro' : 'registros'}</small></span><ChevronRight size={18}/></summary>
        <div className="item-edit-section-body">{history.length ? <div className="item-history">{history.map(({ purchase, item: bought }) => { const normalized = normalizedPrice(bought); const originalName = bought.originalDescription || bought.importedProductName; return <article key={`${purchase.id}-${bought.id}`}><div><b>{shortDate(purchase.purchasedAt)} · {purchase.marketName}</b><small>{[bought.variety, bought.brand].filter(Boolean).join(' · ') || 'Sem sabor/tipo ou marca'} · {bought.quantity} × {bought.packageSize} {bought.packageUnit}</small>{originalName && <small className="history-original-name">Na nota: {originalName}</small>}{normalized && <em>{money(normalized.value)} / {normalized.unit}</em>}</div><strong>{money(bought.totalPrice)}</strong></article> })}</div> : <p className="collapsed-empty">Nenhuma compra anterior encontrada para {initial.name}.</p>}</div>
      </details>

      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary"><Check size={17}/> Salvar alterações</button></div>
    </form>
  </Modal>
}

function ProductMergeModal({ initialLeft, initialRight, onClose, onMerge }) {
  const [left, setLeft] = useState(initialLeft)
  const [right, setRight] = useState(initialRight)
  const [mode, setMode] = useState('merge')
  const [variantValue, setVariantValue] = useState(() => inferredVariantValue(initialLeft.name, initialRight.name))
  const [result, setResult] = useState({ name: initialLeft.name, category: initialLeft.category || 'Outros', defaultUnit: initialLeft.defaultUnit || 'un', recurrenceDays: initialLeft.recurrenceDays ?? null })
  const preview = combineProductVariants(left, right, mode, variantValue, true)
  const applyProductData = (product) => setResult((current) => ({ ...current, name: product.name, category: product.category || 'Outros', defaultUnit: product.defaultUnit || 'un', recurrenceDays: product.recurrenceDays ?? null }))
  const swap = () => { setLeft(right); setRight(left); applyProductData(right); setVariantValue(inferredVariantValue(right.name, left.name)) }
  const productSide = (product, label) => <article className="merge-side-card"><header><span>{label}</span><b>{product.name}</b><small>{product.category || 'Outros'} · {product.defaultUnit || 'un'}</small></header><div className="merge-side-stats"><span>{normalizeProductVariants(product.variants).length} variações</span><span>{(product.brands || []).length} marcas</span></div><div className="merge-variant-list">{normalizeProductVariants(product.variants).slice(0, 5).map((variant) => <span key={variant.id}>{[variant.variety, variant.brand, `${variant.packageSize} ${variant.packageUnit}`].filter(Boolean).join(' · ')}</span>)}{normalizeProductVariants(product.variants).length > 5 && <small>+{normalizeProductVariants(product.variants).length - 5} variações</small>}</div><button type="button" className="secondary full" onClick={() => applyProductData(product)}>Usar dados deste lado</button></article>
  return <Modal title="Normalizar produtos" subtitle="Compare os dois registros e defina o produto final." onClose={onClose} wide>
    <div className="merge-mode-switch"><button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}><GitMerge size={17}/><span><b>Fundir produtos iguais</b><small>Combina as variações dos dois registros</small></span></button><button className={mode === 'variant' ? 'active' : ''} onClick={() => setMode('variant')}><PackagePlus size={17}/><span><b>Transformar B em variação de A</b><small>Move o segundo produto para dentro do primeiro</small></span></button></div>
    <button type="button" className="swap-products" onClick={swap}><ArrowLeftRight size={15}/> Trocar lados A e B</button>
    <div className="merge-columns">
      {productSide(left, 'Lado A · produto principal')}
      {productSide(right, 'Lado B · produto absorvido')}
      <article className="merge-result-card"><header><span>Resultado final</span><b>{result.name || 'Produto sem nome'}</b><small>{preview.variants.length} variações após normalizar</small></header><Field label="Nome do produto"><input value={result.name} onChange={(event) => setResult({ ...result, name: event.target.value })}/></Field><Field label="Categoria"><select value={result.category} onChange={(event) => setResult({ ...result, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Unidade padrão"><select value={result.defaultUnit} onChange={(event) => setResult({ ...result, defaultUnit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>{mode === 'variant' && <Field label="Sabor / tipo aplicado ao lado B"><input value={variantValue} onChange={(event) => setVariantValue(event.target.value)} placeholder="Ex.: Amargo, Tradicional"/><small>Esse valor será aplicado às variações vindas de {right.name}.</small></Field>}<div className="merge-result-variants">{preview.variants.map((variant) => <span key={variant.id}>{[variant.variety, variant.brand, `${variant.packageSize} ${variant.packageUnit}`].filter(Boolean).join(' · ')}</span>)}</div></article>
    </div>
    <p className="warning">O produto do lado B será ocultado. Compras, listas e mapeamentos serão redirecionados para o resultado final.</p>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!result.name.trim() || (mode === 'variant' && !variantValue.trim())} onClick={() => onMerge({ leftId: left.id, rightId: right.id, mode, variantValue: variantValue.trim(), result: { ...result, name: result.name.trim() } })}><GitMerge size={17}/> Confirmar normalização</button></div>
  </Modal>
}

function ImportModal({ onClose, onReview, toast }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const readFile = (file) => file?.text().then(setText)
  const copyPrompt = () => copyText(RECEIPT_PROMPT).then(() => toast('Prompt copiado.')).catch(() => setError('Não foi possível copiar o prompt.'))
  return <Modal title="Importar nota em JSON" subtitle="Nada será salvo antes da sua revisão." onClose={onClose} wide>
    <div className="import-prompt-callout"><div><b>Primeiro gere o JSON</b><small>Anexe a foto da nota à IA e use o prompt no formato esperado.</small></div><button className="secondary" onClick={copyPrompt}><ClipboardCopy size={17}/> Copiar prompt</button></div>
    <Field label="Cole o JSON gerado pela IA"><textarea className="json-input" value={text} onChange={(e) => { setText(e.target.value); setError('') }} placeholder='{ "mercado": ..., "itens": [...] }'/></Field>
    <div className="file-row"><input type="file" accept="application/json,.json" onChange={(e) => readFile(e.target.files[0])}/></div>{error && <p className="error">{error}</p>}
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!text.trim()} onClick={() => { try { onReview(normalizeImport(parseJsonInput(text))) } catch (e) { setError(e.message || 'JSON inválido.') } }}>Revisar importação</button></div>
  </Modal>
}

function ManualPurchaseModal({ markets, onClose, onReview }) { const [market, setMarket] = useState({ name: '', cnpj: '', legalName: '', address: '' }); const [date, setDate] = useState(dateTimeLocal()); const [items, setItems] = useState([]); const add = () => setItems([...items, { id: uid(), productName: '', variety: '', brand: '', category: 'Outros', quantity: 1, packageSize: 1, packageUnit: 'un', unitPrice: 0, totalPrice: 0, originalDescription: '', barcode: '' }]); return <Modal title="Registrar compra manual" subtitle="Adicione os itens e revise antes de salvar." onClose={onClose} wide><div className="form-grid"><Field label="Mercado"><input value={market.name} onChange={(e) => setMarket({ ...market, name: e.target.value })} list="markets" placeholder="Nome do mercado"/><datalist id="markets">{markets.map((m) => <option key={m.id} value={m.name}/>)}</datalist></Field><Field label="Data"><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}/></Field></div><Field label="CNPJ (opcional)"><input value={market.cnpj} onChange={(e) => setMarket({ ...market, cnpj: e.target.value })}/></Field><EditableItems items={items} setItems={setItems}/><button className="secondary full" onClick={add}><Plus size={17}/> Adicionar item</button><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!market.name || !items.length} onClick={() => onReview({ market: { ...market, cnpj: onlyDigits(market.cnpj) }, purchasedAt: new Date(date).toISOString(), items })}>Revisar compra</button></div></Modal> }

function ReviewModal({ draft: initial, products, onClose, onSave }) {
  const [draft, setDraft] = useState(initial)
  const [itemFilter, setItemFilter] = useState('all')
  const [filteredItemIds, setFilteredItemIds] = useState([])
  const total = draft.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
  const issueCount = draft.items.filter((item) => itemIssues(item).length).length
  const existingCount = draft.items.filter((item) => findCatalogProduct(products, item)).length
  const exactVariantCount = draft.items.filter((item) => { const product = findCatalogProduct(products, item); return product && findMatchingVariant(product, item) }).length
  const filterCounts = {
    all: draft.items.length,
    'new-product': draft.items.length - existingCount,
    'new-variant': existingCount - exactVariantCount,
    alerts: issueCount,
  }
  const reviewFilters = [
    ['all', 'Todos'],
    ['new-product', 'Novos produtos'],
    ['new-variant', 'Novas variações'],
    ['alerts', 'Com alertas'],
  ]
  const applyItemFilter = (value) => {
    setItemFilter(value)
    setFilteredItemIds(value === 'all' ? [] : draft.items.filter((item) => reviewItemMatchesFilter(products, item, value)).map((item) => item.id))
  }
  return <Modal title="Revise a compra" subtitle="Confirme produtos, marcas, embalagens e valores." onClose={onClose} wide>
    <div className="review-market"><Store/><div className="grow"><b>{draft.market.name || 'Mercado não identificado'}</b><small>{draft.market.cnpj ? `CNPJ ${draft.market.cnpj}` : 'CNPJ não informado'} · {shortDate(draft.purchasedAt)}</small></div><strong>{money(total)}</strong></div>
    <details className="receipt-data-editor" open={draft.purchaseDateInferred || !draft.market.name}>
      <summary><span><b>Dados da nota</b><small>Mercado, data e identificação do documento</small></span><Pencil size={16}/><ChevronRight className="receipt-data-chevron" size={18}/></summary>
      <div className="receipt-data-fields form-grid">
        <Field label="Nome do mercado"><input value={draft.market.name || ''} onChange={(event) => setDraft({ ...draft, market: { ...draft.market, name: event.target.value } })} placeholder="Nome fantasia"/></Field>
        <Field label="Razão social"><input value={draft.market.legalName || ''} onChange={(event) => setDraft({ ...draft, market: { ...draft.market, legalName: event.target.value } })} placeholder="Opcional"/></Field>
        <Field label="CNPJ"><input inputMode="numeric" value={draft.market.cnpj || ''} onChange={(event) => setDraft({ ...draft, market: { ...draft.market, cnpj: onlyDigits(event.target.value) } })} placeholder="Somente números"/></Field>
        <Field label="Data da compra"><input type="datetime-local" value={dateTimeLocal(draft.purchasedAt)} onChange={(event) => { if (event.target.value) setDraft({ ...draft, purchasedAt: new Date(event.target.value).toISOString(), purchaseDateInferred: false }) }}/></Field>
        <Field label="Número da nota/cupom"><input value={draft.documentNumber || ''} onChange={(event) => setDraft({ ...draft, documentNumber: event.target.value })} placeholder="Opcional"/></Field>
        <Field label="Total declarado"><input type="number" min="0" step="0.01" value={draft.declaredTotal || ''} onChange={(event) => setDraft({ ...draft, declaredTotal: Number(event.target.value) || 0 })}/></Field>
        <Field label="Endereço" ><input value={draft.market.address || ''} onChange={(event) => setDraft({ ...draft, market: { ...draft.market, address: event.target.value } })} placeholder="Endereço do estabelecimento"/></Field>
      </div>
    </details>
    <div className={`review-overview ${issueCount ? 'has-issues' : ''}`}><div><b>{draft.items.length} itens para validar</b><small>{exactVariantCount} variações exatas · {existingCount - exactVariantCount} novas variações · {draft.items.length - existingCount} novos produtos</small></div><span>{issueCount ? <><AlertTriangle size={15}/>{issueCount} {issueCount === 1 ? 'item pede atenção' : 'itens pedem atenção'}</> : <><Check size={15}/>Tudo preenchido</>}</span></div>
    <div className="review-filters" aria-label="Filtrar itens da revisão">{reviewFilters.map(([value, label]) => <button type="button" className={itemFilter === value ? 'active' : ''} aria-pressed={itemFilter === value} key={value} onClick={() => applyItemFilter(value)}><span>{label}</span><b>{filterCounts[value]}</b></button>)}</div>
    {(draft.importWarnings || []).map((warning, index) => <p className="warning" key={`${warning}-${index}`}>{warning}</p>)}
    {draft.purchaseDateInferred && <p className="warning">A nota não informou uma data válida. Corrija a data em “Dados da nota”.</p>}
    {draft.declaredTotal > 0 && Math.abs(draft.declaredTotal - total) > 0.02 && <p className="warning">A soma dos itens ({money(total)}) difere do total declarado ({money(draft.declaredTotal)}).</p>}
    <EditableItems items={draft.items} products={products} compact filter={itemFilter} filteredItemIds={filteredItemIds} showOriginal={draft.source === 'json'} setItems={(items) => setDraft({ ...draft, items })}/>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!draft.items.length} onClick={() => onSave(draft)}><Check size={17}/> Confirmar compra</button></div>
  </Modal>
}

function EditPurchaseModal({ purchase, market: savedMarket, onClose, onSave }) {
  const [market, setMarket] = useState({ id: purchase.marketId, name: purchase.marketName || '', cnpj: '', ...(savedMarket || {}) })
  const [purchasedAt, setPurchasedAt] = useState(dateTimeLocal(purchase.purchasedAt))
  const submit = (event) => {
    event.preventDefault()
    if (!market.name.trim() || !purchasedAt) return
    onSave({ market: { ...market, name: market.name.trim(), cnpj: onlyDigits(market.cnpj) }, purchasedAt: new Date(purchasedAt).toISOString() })
  }
  return <Modal title="Editar compra" subtitle="Corrija os dados do mercado e a data da compra." onClose={onClose}>
    <form onSubmit={submit}>
      <Field label="Nome do mercado"><input autoFocus required value={market.name} onChange={(event) => setMarket({ ...market, name: event.target.value })} placeholder="Ex.: Mercado Central"/></Field>
      <Field label="Data da compra"><input required type="datetime-local" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)}/></Field>
      <Field label="CNPJ"><input inputMode="numeric" value={market.cnpj || ''} onChange={(event) => setMarket({ ...market, cnpj: event.target.value })} placeholder="00.000.000/0000-00"/></Field>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary"><Check size={17}/> Salvar alterações</button></div>
    </form>
  </Modal>
}

function ShareListModal({ list, onClose, toast }) {
  const text = shoppingListShareText(list.items)
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Lista de mercado', text })
        onClose()
        return
      }
      await copyText(text)
      toast('Lista copiada para compartilhar.')
      onClose()
    } catch (error) {
      if (error?.name !== 'AbortError') toast('Não foi possível compartilhar a lista.')
    }
  }
  return <Modal title="Compartilhar lista" subtitle="Confira os itens que vão no texto." onClose={onClose}>
    <pre className="share-preview">{text}</pre>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={share}><Share2 size={17}/> Compartilhar</button></div>
  </Modal>
}

function EditableItems({ items, setItems, products = [], compact = false, filter = 'all', filteredItemIds = [], showOriginal = false }) {
  const wrapField = (item, key, label, children, options = {}) => showOriginal && item.originalValues
    ? <ItemReviewField label={label} original={options.original ?? item.originalValues[key]} current={options.current ?? item[key]} originalLabel={options.originalLabel}>{children}</ItemReviewField>
    : <Field label={label}>{children}</Field>
  const fields = (item, heading) => <>
    <div className="edit-item-head"><b>{heading}</b><button type="button" className="icon-button danger" aria-label="Remover item" onClick={() => setItems(items.filter((saved) => saved.id !== item.id))}><Trash2 size={16}/></button></div>
    {item.originalDescription && <small className="original">Nota: {item.originalDescription}</small>}
    <div className="form-grid review-item-fields">
      {wrapField(item, 'productName', 'Produto', <input value={item.productName} onChange={(event) => updateItem(items, setItems, item.id, { productName: event.target.value, productId: '', variantId: '', catalogDecision: 'new', matchReason: '' })}/>) }
      {wrapField(item, 'variety', 'Sabor / tipo', <input value={item.variety || ''} onChange={(event) => updateItem(items, setItems, item.id, { variety: event.target.value, variantId: '' })} placeholder="Ex.: Tradicional, Amargo, Integral"/>) }
      {wrapField(item, 'brand', 'Marca', <input value={item.brand || ''} onChange={(event) => updateItem(items, setItems, item.id, { brand: event.target.value, variantId: '' })}/>) }
      {wrapField(item, 'category', 'Categoria', <select value={item.category} onChange={(event) => updateItem(items, setItems, item.id, { category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>) }
      {wrapField(item, 'quantity', 'Qtd. comprada', <input type="number" step="0.001" value={item.quantity} onChange={(event) => updateItem(items, setItems, item.id, { quantity: Number(event.target.value) })}/>) }
      {wrapField(item, 'packageSize', 'Tamanho embalagem', <div className="joined"><input type="number" step="0.001" value={item.packageSize} onChange={(event) => updateItem(items, setItems, item.id, { packageSize: Number(event.target.value), variantId: '' })}/><select value={item.packageUnit} onChange={(event) => updateItem(items, setItems, item.id, { packageUnit: event.target.value, variantId: '' })}>{['un','kg','g','L','ml'].map((unit) => <option key={unit}>{unit}</option>)}</select></div>, { original: `${item.originalValues?.packageSize ?? ''}|${item.originalValues?.packageUnit ?? ''}`, current: `${item.packageSize}|${item.packageUnit}`, originalLabel: `${item.originalValues?.packageSize ?? '—'} ${item.originalValues?.packageUnit || ''}`.trim() }) }
      {wrapField(item, 'unitPrice', 'Preço unitário', <input type="number" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(items, setItems, item.id, { unitPrice: Number(event.target.value), totalPrice: Number(event.target.value) * Number(item.quantity) })}/>, { originalLabel: money(item.originalValues?.unitPrice) }) }
      {wrapField(item, 'totalPrice', 'Preço total', <input type="number" step="0.01" value={item.totalPrice} onChange={(event) => updateItem(items, setItems, item.id, { totalPrice: Number(event.target.value) })}/>, { originalLabel: money(item.originalValues?.totalPrice) }) }
    </div>
  </>
  const visibleIds = new Set(filteredItemIds)
  const filteredItems = compact && filter !== 'all' ? items.filter((item) => visibleIds.has(item.id)) : items
  const displayedItems = compact ? [...filteredItems].sort((first, second) => Number(Boolean(itemIssues(second).length)) - Number(Boolean(itemIssues(first).length))) : filteredItems
  if (compact && !displayedItems.length) return <p className="review-filter-empty">Nenhum item corresponde a este filtro.</p>
  return <div className={`editable-items ${compact ? 'compact' : ''}`}>{displayedItems.map((item, index) => {
    if (!compact) return <div className="edit-item" key={item.id}>{fields(item, `Item ${index + 1}`)}</div>
    const issues = itemIssues(item)
    const catalogProduct = findCatalogProduct(products, item)
    const matchingVariant = catalogProduct && findMatchingVariant(catalogProduct, item)
    const catalogStatus = !catalogProduct ? 'Novo produto' : matchingVariant ? 'Variação exata' : 'Nova variação'
    return <details className={`edit-item compact-item ${issues.length ? 'has-issues' : ''}`} key={item.id}>
      <summary><span className="compact-index">{index + 1}</span><span className="compact-product"><b>{item.productName || 'Produto não informado'}</b><small>{[item.variety, item.brand].filter(Boolean).join(' · ') || 'Sem sabor/tipo ou marca'} · {item.packageSize || 0} {item.packageUnit || '—'} · {money(item.totalPrice)}</small></span><span className={`catalog-badge ${matchingVariant ? 'existing' : 'new'}`}>{matchingVariant ? <PackageCheck size={14}/> : <PackagePlus size={14}/>} {catalogStatus}</span>{issues.length ? <span className="issue-badge"><AlertTriangle size={14}/>{issues.length}</span> : <span className="ok-badge"><Check size={14}/></span>}<ChevronRight className="compact-chevron" size={18}/></summary>
      <div className="compact-item-body"><ProductMatchEditor item={item} items={items} setItems={setItems} products={products}/>{issues.length > 0 && <div className="item-issues">{issues.map((issue) => <span key={issue}><AlertTriangle size={13}/>{issue}</span>)}</div>}{item.importWarnings?.length > 0 && <button type="button" className="reviewed-warnings" onClick={() => updateItem(items, setItems, item.id, { importWarnings: [] })}><Check size={14}/> Marcar alertas da IA como revisados</button>}{fields(item, 'Dados do item')}</div>
    </details>
  })}</div>
}

function ItemReviewField({ label, original, current, originalLabel, children }) {
  const unchanged = reviewValuesEqual(original, current)
  const Icon = unchanged ? Check : Pencil
  const previous = originalLabel ?? (String(original ?? '').trim() || 'Não informado')
  return <label className={`field review-field ${unchanged ? 'unchanged-field' : 'changed-field'}`}><span className="review-field-heading"><b>{label}</b><small className={unchanged ? 'unchanged' : 'changed'} title={unchanged ? 'Mantido como veio no JSON' : 'Alterado durante a revisão'}><Icon size={unchanged ? 12 : 14}/><strong>{unchanged ? 'Mantido' : 'Alterado'}</strong><span>{unchanged ? 'Original' : 'Antes'}: {previous}</span></small></span>{children}</label>
}

function reviewValuesEqual(first, second) {
  if (typeof first === 'number' || typeof second === 'number') return Number(first || 0) === Number(second || 0)
  return normalizeText(String(first ?? '')) === normalizeText(String(second ?? ''))
}

function reviewItemMatchesFilter(products, item, filter) {
  if (filter === 'all') return true
  const product = findCatalogProduct(products, item)
  if (filter === 'new-product') return !product
  if (filter === 'new-variant') return Boolean(product) && !findMatchingVariant(product, item)
  if (filter === 'alerts') return itemIssues(item).length > 0
  return true
}

function ProductMatchEditor({ item, items, setItems, products }) {
  const selected = findCatalogProduct(products, item)
  const suggested = !selected && (products.find((product) => product.id === item.suggestedProductId) || bestCatalogSuggestion(products, item))
  const activeProducts = products.filter((product) => !product.archivedAt).sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
  const variants = normalizeProductVariants(selected?.variants)
  const matchingVariant = selected && (variants.find((variant) => variant.id === item.variantId) || findMatchingVariant(selected, item))
  const selectProduct = (product, reason = 'manual') => updateItem(items, setItems, item.id, { productId: product.id, variantId: '', productName: product.name, category: product.category || item.category, catalogDecision: 'existing', matchReason: reason, importMissingFields: (item.importMissingFields || []).filter((field) => !['productName', 'category'].includes(field)) })
  const selectVariant = (variant) => updateItem(items, setItems, item.id, { variantId: variant.id, variety: variant.variety || '', brand: variant.brand || '', packageSize: variant.packageSize, packageUnit: variant.packageUnit, barcode: variant.barcode || item.barcode, matchReason: 'manual' })
  const markNew = () => updateItem(items, setItems, item.id, { productId: '', variantId: '', productName: item.importedProductName || item.productName, catalogDecision: 'new', matchReason: 'manual' })
  const markNewVariant = () => {
    const original = item.originalValues || {}
    updateItem(items, setItems, item.id, { variantId: '', variety: original.variety ?? item.variety, brand: original.brand ?? item.brand, packageSize: original.packageSize ?? item.packageSize, packageUnit: original.packageUnit ?? item.packageUnit, matchReason: 'manual' })
  }
  return <section className="catalog-selection">
    <div className="catalog-selection-grid">
      <label><span>1. Produto no catálogo</span><select value={selected?.id || 'new'} onChange={(event) => { const product = products.find((saved) => saved.id === event.target.value); if (product) selectProduct(product); else markNew() }}><option value="new">Cadastrar como novo produto</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.category}</option>)}</select></label>
      <label><span>2. Variação no catálogo</span><select disabled={!selected} value={selected ? matchingVariant?.id || 'new' : ''} onChange={(event) => { const variant = variants.find((saved) => saved.id === event.target.value); if (variant) selectVariant(variant); else markNewVariant() }}><option value={selected ? 'new' : ''}>{selected ? 'Cadastrar como nova variação' : 'Selecione primeiro o produto'}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{[variant.variety, variant.brand, `${variant.packageSize} ${variant.packageUnit}`].filter(Boolean).join(' · ')}</option>)}</select></label>
    </div>
    {suggested && <button type="button" className="catalog-suggestion" onClick={() => selectProduct(suggested, 'suggestion')}><PackageCheck size={13}/> Sugestão: usar {suggested.name}</button>}
    {selected && item.importedProductName && normalizeText(item.importedProductName) !== normalizeText(selected.name) && <small className="mapping-explanation">“{item.importedProductName}” será registrado como <b>{selected.name}</b>.</small>}
  </section>
}

function findMatchingVariant(product, item) { return normalizeProductVariants(product.variants).find((variant) => variantMatchesItem(variant, item)) }

function PurchaseDetail({ purchase, market, onClose, onEdit, onDelete }) { return <Modal title={purchase.marketName} subtitle={`${shortDate(purchase.purchasedAt)} · ${purchase.items.length} itens${market?.cnpj ? ` · CNPJ ${market.cnpj}` : ''}`} onClose={onClose} wide><div className="receipt-total"><span>Total</span><strong>{money(purchase.total)}</strong></div><div className="purchase-detail-actions"><button className="secondary" onClick={onEdit}><Pencil size={17}/> Editar compra</button><button className="secondary danger purchase-delete-button" onClick={onDelete}><Trash2 size={17}/> Remover compra</button></div><div className="receipt-items">{purchase.items.map((item) => { const normalized = normalizedPrice(item); const mappedFrom = item.originalDescription || item.importedProductName; const showMapping = mappedFrom && normalizeText(mappedFrom) !== normalizeText(item.productName); return <div key={item.id}><div><b>{item.productName}</b><small>{[item.variety, item.brand].filter(Boolean).join(' · ') || 'Sem sabor/tipo ou marca'} · {item.quantity} × {item.packageSize} {item.packageUnit}</small>{showMapping && <small className="purchase-mapping"><PackageCheck size={12}/> Mapeado de “{mappedFrom}”</small>}{normalized && <em>{money(normalized.value)} / {normalized.unit}</em>}</div><strong>{money(item.totalPrice)}</strong></div> })}</div></Modal> }

function DeletePurchaseModal({ purchase, onClose, onConfirm }) {
  return <Modal title="Remover compra?" subtitle="Esta ação não pode ser desfeita." onClose={onClose}>
    <div className="delete-purchase-summary"><span className="card-icon"><Store/></span><div><b>{purchase.marketName}</b><small>{shortDate(purchase.purchasedAt)} · {purchase.items.length} itens</small></div><strong>{money(purchase.total)}</strong></div>
    <p className="warning">A compra será excluída dos indicadores e do histórico de preços dos produtos. Os últimos preços serão recalculados com as compras restantes.</p>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary destructive" onClick={onConfirm}><Trash2 size={17}/> Remover definitivamente</button></div>
  </Modal>
}

function PromptModal({ onClose, toast }) { return <Modal title="Prompt para leitura da nota" subtitle="Anexe a foto da nota à IA e envie este texto." onClose={onClose} wide><pre className="prompt-box">{RECEIPT_PROMPT}</pre><div className="modal-actions"><button className="secondary" onClick={onClose}>Fechar</button><button className="primary" onClick={() => navigator.clipboard.writeText(RECEIPT_PROMPT).then(() => toast('Prompt copiado.'))}><ClipboardCopy size={17}/> Copiar prompt</button></div></Modal> }

const MISSING_FIELD_LABELS = { productName: 'Produto não informado', quantity: 'Quantidade não informada (assumido 1)', packageSize: 'Tamanho da embalagem não informado (assumido 1)', packageUnit: 'Unidade da embalagem não informada (assumido un)', totalPrice: 'Preço total não informado', category: 'Categoria não informada (assumido Outros)' }
function itemIssues(item) {
  const issues = [
    ...(item.importMissingFields || []).map((field) => MISSING_FIELD_LABELS[field]).filter(Boolean),
    ...(item.importWarnings || []),
  ]
  if (!String(item.productName || '').trim()) issues.push('Informe o produto')
  if (!(Number(item.quantity) > 0)) issues.push('Informe uma quantidade válida')
  if (!(Number(item.packageSize) > 0)) issues.push('Informe o tamanho da embalagem')
  if (!['un', 'kg', 'g', 'L', 'ml'].includes(item.packageUnit)) issues.push('Confira a unidade da embalagem')
  if (!CATEGORIES.includes(item.category)) issues.push('Confira a categoria')
  if (!(Number(item.totalPrice) > 0)) issues.push('Informe o preço total')
  return [...new Set(issues)]
}
function findCatalogProduct(products, item) {
  if (item.catalogDecision === 'new') return undefined
  return products.find((product) => product.id === item.productId) || products.find((product) => normalizeText(product.name) === normalizeText(item.productName))
}
function updateItem(items, setter, id, patch) {
  setter(items.map((item) => {
    if (item.id !== id) return item
    const changedFields = Object.keys(patch)
    return { ...item, ...patch, importMissingFields: (item.importMissingFields || []).filter((field) => !changedFields.includes(field)) }
  }))
}
const CATEGORY_EMOJIS = { Hortifruti: '🥬', Mercearia: '🥫', Frios: '🧀', Carnes: '🥩', Bebidas: '🥤', Limpeza: '🧹', Higiene: '🧴', Outros: '📦' }
function shoppingListShareText(items) {
  const title = '🛒 Lista de mercado'
  if (!items.length) return `${title}\n\nLista vazia.`
  const categories = [...CATEGORIES, ...new Set(items.map((item) => item.category || 'Outros').filter((category) => !CATEGORIES.includes(category)))]
  const sections = categories.map((category) => {
    const categoryItems = items.filter((item) => (item.category || 'Outros') === category)
    if (!categoryItems.length) return null
    const lines = categoryItems.map((item) => {
      const details = [`${item.quantity} ${item.unit}`, item.note].filter(Boolean).join(' · ')
      return `• ${item.name}${details ? ` — ${details}` : ''}`
    })
    return `${CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS.Outros} ${category}\n${lines.join('\n')}`
  }).filter(Boolean)
  return `${title}\n\n${sections.join('\n\n')}`
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}
function findOrCreateMarketId(markets, market) { const cnpj = onlyDigits(market.cnpj); return markets.find((item) => (cnpj && onlyDigits(item.cnpj) === cnpj) || (!cnpj && normalizeText(item.name) === normalizeText(market.name)))?.id || uid() }
function productMappingKey(item) {
  const barcode = onlyDigits(item.barcode)
  if (barcode) return `barcode:${barcode}`
  const description = normalizeText(item.originalDescription)
  return description ? `description:${description}` : ''
}
function textSimilarity(first, second) {
  const a = normalizeText(first); const b = normalizeText(second)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * .25 + .7
  const aTokens = new Set(a.split(/\s+/)); const bTokens = new Set(b.split(/\s+/))
  const shared = [...aTokens].filter((token) => bTokens.has(token)).length
  return shared / new Set([...aTokens, ...bTokens]).size
}
function bestCatalogSuggestion(products, item) {
  const query = item.importedProductName || item.productName
  const ranked = products.filter((product) => !product.archivedAt).map((product) => ({ product, score: textSimilarity(query, product.name) })).sort((first, second) => second.score - first.score)
  return ranked[0]?.score >= .48 ? ranked[0].product : null
}
function prepareDraftProductMatches(draft, products, mappings = []) {
  return { ...draft, items: draft.items.map((item) => {
    const importedProductName = item.importedProductName || item.productName
    const originalValues = item.originalValues || {
      productName: item.productName || '',
      variety: item.variety || '',
      brand: item.brand || '',
      category: item.category || 'Outros',
      quantity: Number(item.quantity) || 0,
      packageSize: Number(item.packageSize) || 0,
      packageUnit: item.packageUnit || '',
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0,
    }
    const key = productMappingKey(item)
    const savedMapping = key ? mappings.find((mapping) => mapping.sourceKey === key) : null
    const mappedProduct = savedMapping ? products.find((product) => product.id === savedMapping.productId) : null
    const mappedVariant = mappedProduct && savedMapping?.variantId ? normalizeProductVariants(mappedProduct.variants).find((variant) => variant.id === savedMapping.variantId) : null
    const exactProduct = products.find((product) => !product.archivedAt && normalizeText(product.name) === normalizeText(item.productName))
    const selectedProduct = mappedProduct || exactProduct
    const suggestedProduct = selectedProduct || bestCatalogSuggestion(products, { ...item, importedProductName })
    return selectedProduct ? {
      ...item,
      importedProductName,
      originalValues,
      productName: selectedProduct.name,
      ...(mappedVariant ? {
        variantId: mappedVariant.id,
        variety: mappedVariant.variety || '',
        brand: mappedVariant.brand || '',
        packageSize: mappedVariant.packageSize,
        packageUnit: mappedVariant.packageUnit,
        barcode: mappedVariant.barcode || item.barcode || '',
      } : {}),
      productId: selectedProduct.id,
      catalogDecision: 'existing',
      matchReason: mappedProduct ? 'history' : 'exact',
      suggestedProductId: suggestedProduct?.id || '',
      importMissingFields: (item.importMissingFields || []).filter((field) => field !== 'productName' && (!mappedVariant || !['packageSize', 'packageUnit'].includes(field))),
    } : { ...item, importedProductName, originalValues, productId: '', catalogDecision: 'new', matchReason: '', suggestedProductId: suggestedProduct?.id || '' }
  }) }
}
function updateProductMappings(savedMappings = [], sourceItems, linkedItems) {
  let mappings = [...savedMappings]
  sourceItems.forEach((item, index) => {
    const sourceKey = productMappingKey(item)
    const linked = linkedItems[index]
    if (!sourceKey || !linked?.productId) return
    const previous = mappings.find((mapping) => mapping.sourceKey === sourceKey)
    const mapping = { id: previous?.id || uid(), sourceKey, sourceDescription: item.originalDescription || '', importedProductName: item.importedProductName || item.productName || '', productId: linked.productId, variantId: linked.variantId || '', createdAt: previous?.createdAt || nowIso(), updatedAt: nowIso() }
    mappings = previous ? mappings.map((saved) => saved.id === previous.id ? mapping : saved) : [...mappings, mapping]
  })
  return mappings
}
function normalizeProductVariants(variants = []) {
  return variants.map((variant) => {
    if (typeof variant === 'object' && variant) {
      const normalized = { packageSize: 1, packageUnit: 'un', variety: '', brand: '', barcode: '', ...variant, id: variant.id || uid() }
      if (!normalized.variety && normalized.flavor) normalized.variety = normalized.flavor
      return normalized
    }
    const [brand = '', packageSize = '1', packageUnit = 'un'] = String(variant || '').split('|')
    return { id: uid(), variety: '', brand, packageSize: Number(packageSize) || 1, packageUnit: packageUnit || 'un', barcode: '', createdAt: nowIso() }
  })
}
function variantMatchesItem(variant, item) {
  return normalizeText(variant.variety) === normalizeText(item.variety) && normalizeText(variant.brand) === normalizeText(item.brand) && Number(variant.packageSize || 1) === Number(item.packageSize || 1) && variant.packageUnit === (item.packageUnit || 'un')
}
function productNames(product) {
  return new Set([product?.name, ...(product?.aliases || [])].map(normalizeText).filter(Boolean))
}
function itemBelongsToProduct(state, item, product) {
  if (item.productId === product.id) return true
  const hasValidProductId = item.productId && state.products.some((saved) => saved.id === item.productId)
  return !hasValidProductId && productNames(product).has(normalizeText(item.productName || item.name))
}
function canonicalProductForItem(state, item) {
  const itemName = normalizeText(item.productName || item.name)
  const mergedAlias = state.products.find((saved) => saved.mergedIntoId && productNames(saved).has(itemName))
  let product = mergedAlias || (item.productId ? state.products.find((saved) => saved.id === item.productId) : null)
  if (product?.archivedAt && !product.mergedIntoId) {
    const legacyName = itemName || normalizeText(product.name)
    product = state.products.find((saved) => !saved.archivedAt && saved.id !== product.id && productNames(saved).has(legacyName)) || product
  }
  if (!product) {
    product = state.products.find((saved) => !saved.archivedAt && productNames(saved).has(itemName))
      || state.products.find((saved) => productNames(saved).has(itemName))
  }
  const visited = new Set()
  while (product?.mergedIntoId && !visited.has(product.id)) {
    visited.add(product.id)
    product = state.products.find((saved) => saved.id === product.mergedIntoId) || product
    if (!product.mergedIntoId) break
  }
  return product || null
}
function canonicalItem(state, item) {
  const product = canonicalProductForItem(state, item)
  if (!product) return item
  const variants = normalizeProductVariants(product.variants)
  const variant = variants.find((saved) => saved.id === item.variantId) || variants.find((saved) => variantMatchesItem(saved, item))
  return {
    ...item,
    productId: product.id,
    productName: product.name,
    category: product.category || item.category || 'Outros',
    ...(variant ? { variantId: variant.id, variety: variant.variety || '', brand: variant.brand || '', packageSize: variant.packageSize, packageUnit: variant.packageUnit, barcode: variant.barcode || item.barcode || '' } : {}),
  }
}
function updateCatalogProduct(state, previous, next) {
  const variants = normalizeProductVariants(next.variants)
  const savedProduct = {
    ...next,
    aliases: [...new Set([...(previous.aliases || []), ...(normalizeText(previous.name) !== normalizeText(next.name) ? [previous.name] : [])].filter(Boolean))],
    variants,
    updatedAt: nowIso(),
  }
  const updateItem = (item) => {
    if (!itemBelongsToProduct(state, item, previous)) return item
    return canonicalItem({ ...state, products: state.products.map((product) => product.id === savedProduct.id ? savedProduct : product) }, { ...item, productId: savedProduct.id })
  }
  const updateListItem = (item) => itemBelongsToProduct(state, item, previous) ? { ...item, productId: savedProduct.id, name: savedProduct.name, category: savedProduct.category, unit: savedProduct.defaultUnit || item.unit } : item
  const variantIds = new Set(variants.map((variant) => variant.id))
  return {
    ...state,
    products: state.products.map((product) => product.id === savedProduct.id ? savedProduct : product),
    purchases: state.purchases.map((purchase) => ({ ...purchase, items: purchase.items.map(updateItem) })),
    lists: state.lists.map((list) => ({ ...list, items: list.items.map(updateListItem) })),
    productMappings: (state.productMappings || []).map((mapping) => mapping.productId === savedProduct.id ? { ...mapping, variantId: variantIds.has(mapping.variantId) ? mapping.variantId : '', updatedAt: nowIso() } : mapping),
  }
}
function inferredVariantValue(mainName, absorbedName) {
  const main = normalizeText(mainName)
  const words = String(absorbedName || '').split(/\s+/).filter((word) => !main.split(/\s+/).includes(normalizeText(word)))
  return words.join(' ') || absorbedName || ''
}
function combineProductVariants(left, right, mode, variantValue, preview = false) {
  const variants = normalizeProductVariants(left.variants).map((variant) => ({ ...variant }))
  const variantIdMap = {}
  const transformedById = {}
  let rightVariants = normalizeProductVariants(right.variants)
  if (mode === 'variant' && !rightVariants.length) rightVariants = [{ id: preview ? `preview-${right.id}` : uid(), variety: variantValue, brand: '', packageSize: 1, packageUnit: 'un', barcode: '', createdAt: nowIso() }]
  rightVariants.forEach((source) => {
    const transformed = mode === 'variant' ? { ...source, variety: variantValue || source.variety || '' } : { ...source }
    transformedById[source.id] = transformed
    const existing = variants.find((variant) => variantMatchesItem(variant, transformed))
    if (existing) variantIdMap[source.id] = existing.id
    else { variants.push(transformed); variantIdMap[source.id] = transformed.id }
  })
  return { variants, variantIdMap, transformedById }
}
function mergeCatalogProducts(state, plan) {
  const left = state.products.find((product) => product.id === plan.leftId)
  const right = state.products.find((product) => product.id === plan.rightId)
  if (!left || !right || left.id === right.id) return state
  const combined = combineProductVariants(left, right, plan.mode, plan.variantValue)
  const resultProduct = { ...left, ...plan.result, id: left.id, aliases: [...new Set([...(left.aliases || []), ...(right.aliases || []), left.name, right.name].filter((name) => normalizeText(name) !== normalizeText(plan.result.name)))], archivedAt: null, mergedIntoId: null, variants: combined.variants, brands: [...new Set(combined.variants.map((variant) => variant.brand).filter(Boolean))], updatedAt: nowIso() }
  const belongsTo = (item, product) => itemBelongsToProduct(state, item, product)
  const redirectPurchaseItem = (item) => {
    const fromRight = belongsTo(item, right)
    const fromLeft = belongsTo(item, left)
    if (!fromRight && !fromLeft) return item
    let redirected = { ...item, productId: left.id, productName: resultProduct.name, category: resultProduct.category }
    if (fromRight && plan.mode === 'variant') redirected = { ...redirected, variety: plan.variantValue || redirected.variety || '' }
    if (fromRight && item.variantId && combined.variantIdMap[item.variantId]) redirected.variantId = combined.variantIdMap[item.variantId]
    const matching = combined.variants.find((variant) => variantMatchesItem(variant, redirected))
    if (matching) redirected.variantId = matching.id
    return redirected
  }
  const redirectListItems = (items) => items.map((item) => belongsTo(item, left) || belongsTo(item, right) ? { ...item, productId: left.id, name: resultProduct.name, category: resultProduct.category, unit: resultProduct.defaultUnit || item.unit } : item).reduce((merged, item) => {
    const duplicate = item.productId === left.id ? merged.find((saved) => saved.productId === left.id) : null
    if (!duplicate) return [...merged, item]
    return merged.map((saved) => saved.id === duplicate.id ? { ...saved, quantity: Number(saved.quantity || 0) + Number(item.quantity || 0), note: [...new Set([saved.note, item.note].filter(Boolean))].join(' · ') } : saved)
  }, [])
  return {
    ...state,
    products: state.products.map((product) => product.id === left.id ? resultProduct : product.id === right.id ? { ...product, archivedAt: nowIso(), mergedIntoId: left.id } : product),
    purchases: state.purchases.map((purchase) => ({ ...purchase, items: purchase.items.map(redirectPurchaseItem) })),
    lists: state.lists.map((list) => ({ ...list, items: redirectListItems(list.items) })),
    productMappings: (state.productMappings || []).map((mapping) => mapping.productId === right.id ? { ...mapping, productId: left.id, variantId: combined.variantIdMap[mapping.variantId] || mapping.variantId || '', updatedAt: nowIso() } : mapping),
    productNormalizations: [{ id: uid(), leftProductId: left.id, rightProductId: right.id, leftName: left.name, rightName: right.name, resultName: resultProduct.name, mode: plan.mode, variantValue: plan.variantValue || '', createdAt: nowIso() }, ...(state.productNormalizations || [])],
  }
}
function mergeProducts(products, items, purchaseMeta) {
  let result = products.map((product) => ({ ...product, variants: normalizeProductVariants(product.variants) }))
  const linkedItems = items.map((item) => {
    const productKey = normalizeText(item.productName)
    let product = item.catalogDecision === 'existing' && item.productId ? result.find((saved) => saved.id === item.productId) : null
    if (!product && item.catalogDecision !== 'new') product = result.find((saved) => normalizeText(saved.name) === productKey)
    if (!product) {
      product = { id: uid(), name: item.productName, category: item.category || 'Outros', defaultUnit: defaultUnitForProduct(item.productName, item.category), brands: [], variants: [], archivedAt: null, createdAt: nowIso() }
      result.push(product)
    }
    const variants = normalizeProductVariants(product.variants)
    let variant = variants.find((saved) => saved.id === item.variantId || variantMatchesItem(saved, item))
    if (!variant) variant = { id: uid(), variety: item.variety || '', brand: item.brand || '', packageSize: Number(item.packageSize) || 1, packageUnit: item.packageUnit || 'un', barcode: item.barcode || '', createdAt: nowIso() }
    const updatedVariant = { ...variant, variety: item.variety || variant.variety || '', brand: item.brand || variant.brand || '', packageSize: Number(item.packageSize) || 1, packageUnit: item.packageUnit || 'un', barcode: item.barcode || variant.barcode || '', lastPrice: Number(item.unitPrice) || Number(item.totalPrice) / (Number(item.quantity) || 1), lastPurchasedAt: purchaseMeta.purchasedAt, lastMarketName: purchaseMeta.marketName, updatedAt: nowIso() }
    const updatedVariants = variants.some((saved) => saved.id === updatedVariant.id) ? variants.map((saved) => saved.id === updatedVariant.id ? updatedVariant : saved) : [...variants, updatedVariant]
    product = { ...product, archivedAt: null, category: product.category === 'Outros' ? item.category : product.category, defaultUnit: product.defaultUnit || defaultUnitForProduct(item.productName, item.category), variants: updatedVariants, brands: [...new Set(updatedVariants.map((saved) => saved.brand).filter(Boolean))] }
    result = result.map((saved) => saved.id === product.id ? product : saved)
    const { originalValues: _reviewOnlyValues, ...savedItem } = item
    return { ...savedItem, productName: product.name, category: product.category || item.category, productId: product.id, variantId: updatedVariant.id }
  })
  return { products: result, items: linkedItems }
}
function refreshPurchaseMetadata(state) {
  const purchases = [...state.purchases].sort((first, second) => new Date(second.purchasedAt || 0) - new Date(first.purchasedAt || 0))
  const products = state.products.map((product) => {
    const variants = normalizeProductVariants(product.variants).map((variant) => {
      let latest = null
      for (const purchase of purchases) {
        const item = purchase.items.find((saved) => saved.variantId === variant.id || (saved.productId === product.id && variantMatchesItem(variant, saved)))
        if (item) { latest = { purchase, item }; break }
      }
      if (!latest) {
        const { lastPrice: _lastPrice, lastPurchasedAt: _lastPurchasedAt, lastMarketName: _lastMarketName, ...withoutHistory } = variant
        return withoutHistory
      }
      return {
        ...variant,
        lastPrice: Number(latest.item.unitPrice) || Number(latest.item.totalPrice) / (Number(latest.item.quantity) || 1),
        lastPurchasedAt: latest.purchase.purchasedAt,
        lastMarketName: latest.purchase.marketName,
      }
    })
    return { ...product, variants, brands: [...new Set(variants.map((variant) => variant.brand).filter(Boolean))] }
  })
  return { ...state, products }
}
function updatePurchaseDetails(state, purchaseToUpdate, market, purchasedAt) {
  const marketId = purchaseToUpdate.marketId || market.id || uid()
  const markets = state.markets.some((saved) => saved.id === marketId)
    ? state.markets.map((saved) => saved.id === marketId ? { ...saved, ...market, id: marketId } : saved)
    : [...state.markets, { ...market, id: marketId }]
  const purchases = state.purchases.map((purchase) => purchase.id === purchaseToUpdate.id
    ? { ...purchase, marketId, marketName: market.name, purchasedAt }
    : purchase.marketId === marketId ? { ...purchase, marketName: market.name } : purchase)
  return refreshPurchaseMetadata({ ...state, markets, purchases })
}
function removePurchase(state, purchaseId) {
  return refreshPurchaseMetadata({ ...state, purchases: state.purchases.filter((purchase) => purchase.id !== purchaseId) })
}
function purchasesForProduct(state, name) { return state.purchases.filter((purchase) => purchase.items.some((item) => normalizeText(item.productName) === normalizeText(name))).sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)) }
function categoryDefaultDays(category) { return ({ Hortifruti: 7, Frios: 7, Carnes: 14, Mercearia: 30, Bebidas: 30, Limpeza: 60, Higiene: 60, Outros: 30 })[category] || 30 }
function nearestPeriod(days) { return [7, 14, 30, 60, 90].reduce((best, value) => Math.abs(value - days) < Math.abs(best - days) ? value : best, 30) }
function periodicityLabel(days) { return PERIODICITY_OPTIONS.find((option) => Number(option.value) === days)?.label || `A cada ${days} dias` }
function compactPeriodicity(product, frequency) {
  if (frequency.days <= 0) return 'Manual'
  const cadence = `${frequency.days}d`
  return product.recurrenceDays == null ? `Auto · ${cadence}` : cadence
}
function periodicityInfo(state, product) {
  if (product.recurrenceDays != null) return { days: Number(product.recurrenceDays), label: periodicityLabel(Number(product.recurrenceDays)), source: 'manual' }
  const purchases = purchasesForProduct(state, product.name)
  if (purchases.length >= 2) {
    const intervals = purchases.slice(0, 5).map((purchase, index) => index < purchases.length - 1 ? Math.round((new Date(purchase.purchasedAt) - new Date(purchases[index + 1].purchasedAt)) / 86400000) : null).filter((days) => days > 0)
    if (intervals.length) {
      const sorted = [...intervals].sort((a, b) => a - b)
      const days = nearestPeriod(sorted[Math.floor(sorted.length / 2)])
      return { days, label: periodicityLabel(days), source: 'history' }
    }
  }
  const days = categoryDefaultDays(product.category)
  return { days, label: periodicityLabel(days), source: 'category' }
}
function groupedProductSuggestions(state, list) {
  const inList = new Set(list.items.map((item) => normalizeText(item.name)))
  const now = new Date()
  const groups = [
    { id: 'week', label: 'Para esta semana', description: 'Já está na hora ou falta pouco', maxDays: 7, products: [] },
    { id: 'next-week', label: 'Para a próxima semana', description: 'Pode esperar mais alguns dias', maxDays: 14, products: [] },
    { id: 'month', label: 'Para este mês', description: 'Planeje junto com a próxima compra', maxDays: 31, products: [] },
    { id: 'next-month', label: 'Para o próximo mês', description: 'Ainda não precisa entrar na lista', maxDays: 62, products: [] },
  ]
  state.products.forEach((product) => {
    if (product.archivedAt) return
    if (inList.has(normalizeText(product.name))) return
    const history = purchasesForProduct(state, product.name)
    if (!history.length && product.recurrenceDays == null) return
    const frequency = periodicityInfo(state, product)
    if (frequency.days <= 0) return
    const dueAt = history.length ? new Date(new Date(history[0].purchasedAt).getTime() + frequency.days * 86400000) : now
    const daysUntil = Math.ceil((dueAt - now) / 86400000)
    const group = groups.find((candidate) => daysUntil <= candidate.maxDays)
    if (!group) return
    const timing = daysUntil < 0 ? `atrasado há ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) === 1 ? '' : 's'}` : daysUntil === 0 ? 'previsto para hoje' : `previsto em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`
    group.products.push({ ...product, suggestionMeta: `${frequency.label} · ${timing}` })
  })
  return groups.map((group) => ({ ...group, products: group.products.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10) })).filter((group) => group.products.length)
}
function productSelectionKey(product) { const productKey = product.id || normalizeText(product.name); return product.selectedVariant ? `product:${productKey}|variant:${product.selectedVariant.id}` : `product:${productKey}|base` }
function listItemSelectionKey(item) { const productKey = item.productId || normalizeText(item.name); return item.variantId ? `product:${productKey}|variant:${item.variantId}` : `product:${productKey}|base` }
function productToListItem(product) { const variant = product.selectedVariant; return { id: uid(), productId: product.id, name: product.name, quantity: 1, unit: product.defaultUnit || defaultUnitForProduct(product.name, product.category), category: product.category || 'Outros', note: '', checked: false, ...(variant ? { variantId: variant.id, variety: variant.variety || '', brand: variant.brand || '', packageSize: variant.packageSize, packageUnit: variant.packageUnit } : {}) } }
function purchaseHistoryFor(state, name) { return state.purchases.flatMap((purchase) => purchase.items.filter((item) => normalizeText(item.productName) === normalizeText(name)).map((item) => ({ purchase, item }))).sort((a, b) => new Date(b.purchase.purchasedAt) - new Date(a.purchase.purchasedAt)) }
function purchaseHistoryForVariant(state, product, variant) { return state.purchases.flatMap((purchase) => purchase.items.filter((item) => item.variantId ? item.variantId === variant.id : normalizeText(item.productName) === normalizeText(product.name) && variantMatchesItem(variant, item)).map((item) => ({ purchase, item }))).sort((a, b) => new Date(b.purchase.purchasedAt) - new Date(a.purchase.purchasedAt)) }
function priceHistoryForListItem(state, product, listItem) {
  const productId = product?.id || listItem.productId
  const productName = product?.name || listItem.name
  return state.purchases.flatMap((purchase) => purchase.items
    .filter((item) => (productId && item.productId === productId) || normalizeText(item.productName) === normalizeText(productName))
    .map((item) => ({ purchase, item, varietyKey: normalizeText(item.variety) || '__none__', unitPrice: Number(item.unitPrice) || Number(item.totalPrice) / (Number(item.quantity) || 1) })))
    .filter((entry) => entry.unitPrice > 0)
    .sort((a, b) => new Date(b.purchase.purchasedAt) - new Date(a.purchase.purchasedAt))
}
function latestPriceForListItem(state, listItem) {
  const product = state.products.find((saved) => saved.id === listItem.productId) || state.products.find((saved) => normalizeText(saved.name) === normalizeText(listItem.name))
  const history = priceHistoryForListItem(state, product, listItem)
  if (!listItem.variantId && !listItem.variety && !listItem.brand) return history[0]
  return history.find((entry) => entry.item.variantId === listItem.variantId || variantMatchesItem(listItem, entry.item))
}
function estimatedPriceForListItem(state, listItem) {
  const latestPrice = latestPriceForListItem(state, listItem)
  return latestPrice ? latestPrice.unitPrice * (Number(listItem.quantity) || 1) : null
}
function estimateShoppingList(state, list) {
  return list.items.reduce((estimate, item) => {
    const estimatedPrice = estimatedPriceForListItem(state, item)
    if (estimatedPrice == null) return { ...estimate, missingCount: estimate.missingCount + 1 }
    return { ...estimate, total: estimate.total + estimatedPrice, pricedCount: estimate.pricedCount + 1 }
  }, { total: 0, pricedCount: 0, missingCount: 0 })
}
function categoryKey(category = 'Outros') { return normalizeText(category).replace(/\s+/g, '-') }
function itemVariantKey(item) { return `product:${[normalizeText(item.productName), normalizeText(item.variety), normalizeText(item.brand), Number(item.packageSize) || 1, item.packageUnit || 'un'].join('|')}` }
function itemVariantLabel(item) { return [item.variety, item.brand, `${Number(item.packageSize) || 1} ${item.packageUnit || 'un'}`].filter(Boolean).join(' · ') }
function priceRows(state) {
  const groups = new Map()
  state.purchases.forEach((purchase) => purchase.items.forEach((savedItem) => {
    const item = canonicalItem(state, savedItem)
    const key = itemVariantKey(item)
    const normalized = normalizedPrice(item)
    const unitPrice = Number(item.unitPrice) || Number(item.totalPrice) / (Number(item.quantity) || 1)
    const current = groups.get(key) || { id: key, name: item.productName, variant: itemVariantLabel(item), category: item.category || 'Outros', entries: [] }
    current.entries.push({ normalizedValue: normalized?.value, raw: unitPrice, unit: normalized?.unit, date: purchase.purchasedAt, market: purchase.marketName })
    groups.set(key, current)
  }))
  return [...groups.values()].map((group) => {
    const sorted = [...group.entries].sort((first, second) => new Date(second.date) - new Date(first.date))
    const normalizedUnit = group.entries.find((entry) => entry.unit)?.unit
    const comparable = group.entries.filter((entry) => entry.unit === normalizedUnit && Number.isFinite(entry.normalizedValue))
    return { ...group, count: group.entries.length, latest: sorted[0].raw, latestDate: sorted[0].date, min: Math.min(...group.entries.map((entry) => entry.raw)), max: Math.max(...group.entries.map((entry) => entry.raw)), normalizedMin: comparable.length ? Math.min(...comparable.map((entry) => entry.normalizedValue)) : null, unit: normalizedUnit, markets: [...new Set(group.entries.map((entry) => entry.market))], entries: undefined }
  }).sort((first, second) => `${first.name} ${first.variant}`.localeCompare(`${second.name} ${second.variant}`, 'pt-BR'))
}

function analyticsData(state, allPurchases = state.purchases, period = 'all') {
  const purchases = [...state.purchases].sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
  const totalSpent = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0)
  const itemCount = purchases.reduce((sum, purchase) => sum + purchase.items.length, 0)
  const canonicalItems = purchases.flatMap((purchase) => purchase.items.map((item) => canonicalItem(state, item)))
  const uniqueProductKeys = new Set(canonicalItems.map((item) => normalizeText(item.productName)))
  const variantKeys = new Set(canonicalItems.map(itemVariantKey))
  const marketMap = new Map()
  const categoryMap = new Map()

  purchases.forEach((purchase) => {
    const marketName = purchase.marketName || 'Mercado não identificado'
    const market = marketMap.get(marketName) || { name: marketName, total: 0, count: 0, itemCount: 0, latestDate: purchase.purchasedAt }
    market.total += Number(purchase.total || 0)
    market.count += 1
    market.itemCount += purchase.items.length
    if (new Date(purchase.purchasedAt) > new Date(market.latestDate)) market.latestDate = purchase.purchasedAt
    marketMap.set(marketName, market)

    purchase.items.map((item) => canonicalItem(state, item)).forEach((item) => {
      const name = CATEGORIES.includes(item.category) ? item.category : 'Outros'
      const category = categoryMap.get(name) || { name, total: 0, itemCount: 0 }
      category.total += Number(item.totalPrice || 0)
      category.itemCount += 1
      categoryMap.set(name, category)
    })
  })

  const markets = [...marketMap.values()].map((market) => ({ ...market, average: market.total / market.count })).sort((a, b) => b.total - a.total)
  const categories = [...categoryMap.values()].map((category) => ({ ...category, averageItem: category.total / category.itemCount })).sort((a, b) => b.total - a.total)
  const spendingComparison = periodComparison(allPurchases, period, totalSpent)
  const biggestVariation = priceRows(state).filter((row) => row.count > 1 && row.min > 0).map((row) => ({ ...row, variation: (row.max - row.min) / row.min * 100 })).sort((a, b) => b.variation - a.variation)[0]

  return {
    totalSpent,
    purchaseCount: purchases.length,
    averageTicket: purchases.length ? totalSpent / purchases.length : 0,
    itemCount,
    itemsPerPurchase: purchases.length ? itemCount / purchases.length : 0,
    uniqueProducts: uniqueProductKeys.size,
    uniqueVariants: variantKeys.size,
    recentPurchases: purchases.slice(0, 6),
    markets,
    categories,
    spendingComparison,
    biggestVariation,
  }
}

function filterPurchasesByPeriod(purchases, period) {
  if (period === 'all') return purchases
  const start = periodStart(period)
  return purchases.filter((purchase) => new Date(purchase.purchasedAt) >= start)
}

function periodComparison(purchases, period, currentTotal) {
  if (period === 'all') return `${purchases.length} ${purchases.length === 1 ? 'compra no histórico' : 'compras no histórico'}`
  const currentStart = periodStart(period)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - Number(period))
  const previousTotal = purchases.filter((purchase) => { const date = new Date(purchase.purchasedAt); return date >= previousStart && date < currentStart }).reduce((sum, purchase) => sum + Number(purchase.total || 0), 0)
  if (!previousTotal) return `${money(currentTotal)} no período selecionado`
  const variation = (currentTotal - previousTotal) / previousTotal * 100
  return `${variation >= 0 ? '+' : ''}${formatNumber(variation, 0)}% vs. período anterior`
}

function periodStart(period) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - Number(period)); return date }
function formatNumber(value, digits = 0) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0) }
