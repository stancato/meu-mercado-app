import { useEffect, useMemo, useRef, useState } from 'react'
import { Apple, Archive, BarChart3, Bath, Beef, CalendarClock, Check, ChevronRight, CircleDollarSign, ClipboardCopy, Cloud, CloudOff, Coffee, CupSoda, LayoutGrid, List, ListChecks, LogIn, LogOut, Milk, Package, PackageSearch, Pencil, Plus, ReceiptText, Search, Settings, Share2, ShoppingBasket, SprayCan, Store, Tags, Trash2 } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth, firebaseReady, loginWithGoogle } from './firebase'
import { CATEGORIES, RECEIPT_PROMPT, UNITS, dateTimeLocal, defaultUnitForProduct, money, normalizeImport, normalizeText, normalizedPrice, nowIso, onlyDigits, parseJsonInput, shortDate, uid } from './data'
import { Empty, Field, Modal, Toast } from './components'
import { useStore } from './store'

const NAV = [
  ['lists', 'Lista', ListChecks], ['purchases', 'Compras', ReceiptText], ['prices', 'Preços', BarChart3], ['products', 'Produtos', PackageSearch], ['settings', 'Ajustes', Settings],
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

export default function App({ user }) {
  const { state, mutate, syncStatus } = useStore()
  const [tab, setTab] = useState('lists')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast])

  const finishPurchase = (draft) => {
    const marketId = findOrCreateMarketId(state.markets, draft.market)
    const market = { id: marketId, ...draft.market, name: draft.market.name || 'Mercado não identificado' }
    const total = draft.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
    const purchase = { id: uid(), marketId, marketName: market.name, purchasedAt: draft.purchasedAt || nowIso(), documentNumber: draft.documentNumber || '', total, items: draft.items, source: draft.source || 'manual' }
    mutate((current) => {
      const marketExists = current.markets.some((item) => item.id === marketId)
      const products = mergeProducts(current.products, purchase.items)
      return { ...current, purchases: [purchase, ...current.purchases], markets: marketExists ? current.markets.map((item) => item.id === marketId ? { ...item, ...market } : item) : [market, ...current.markets], products }
    })
    setModal(null); setTab('purchases'); setToast('Compra registrada e preços atualizados.')
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><ShoppingBasket size={22} /></span><div><strong>Meu Mercado</strong><small>compre melhor, compare sempre</small></div></div>
      <span className={`sync-pill ${syncStatus}`} title="Situação da sincronização">{syncStatus === 'synced' ? <Cloud size={14}/> : <CloudOff size={14}/>}<span>{syncStatus === 'synced' ? 'Sincronizado' : firebaseReady ? 'Local' : 'Modo local'}</span></span>
    </header>

    <main className="content">
      {tab === 'lists' && <ShoppingListPage state={state} mutate={mutate} open={setModal} />}
      {tab === 'purchases' && <PurchasesPage state={state} open={setModal} />}
      {tab === 'prices' && <PricesPage state={state} />}
      {tab === 'products' && <ProductsPage state={state} mutate={mutate} />}
      {tab === 'settings' && <SettingsPage state={state} user={user} open={setModal} toast={setToast} />}
    </main>

    <nav className="bottom-nav">{NAV.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={21}/><span>{label}</span></button>)}</nav>

    {modal?.type === 'item' && <ItemPanel item={modal.item} state={state} onClose={() => setModal(null)} onSave={(item, updateCatalog) => {
      if (updateCatalog && !window.confirm('Atualizar também o produto no catálogo? Isso afetará sugestões e futuras listas, mas não alterará compras anteriores.')) return
      const originalName = modal.item.name
      mutate((s) => ({
        ...s,
        lists: s.lists.map((list) => ({ ...list, items: list.items.map((old) => old.id === item.id ? item : old) })),
        products: updateCatalog ? updateCatalogProduct(s.products, originalName, item) : s.products,
      }))
      setModal(null); setToast(updateCatalog ? 'Item e produto do catálogo atualizados.' : 'Item atualizado nesta lista.')
    }} />}
    {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} onReview={(draft) => setModal({ type: 'review', draft: { ...draft, source: 'json' } })} />}
    {modal?.type === 'manual' && <ManualPurchaseModal markets={state.markets} onClose={() => setModal(null)} onReview={(draft) => setModal({ type: 'review', draft: { ...draft, source: 'manual' } })} />}
    {modal?.type === 'review' && <ReviewModal draft={modal.draft} onClose={() => setModal(null)} onSave={finishPurchase} />}
    {modal?.type === 'purchase-detail' && <PurchaseDetail purchase={modal.purchase} market={state.markets.find((market) => market.id === modal.purchase.marketId)} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'edit-purchase', purchase: modal.purchase, market: state.markets.find((market) => market.id === modal.purchase.marketId) })} />}
    {modal?.type === 'edit-purchase' && <EditPurchaseModal purchase={modal.purchase} market={modal.market} onClose={() => setModal(null)} onSave={({ market, purchasedAt }) => { const marketId = modal.purchase.marketId || market.id || uid(); mutate((current) => ({ ...current, markets: current.markets.some((saved) => saved.id === marketId) ? current.markets.map((saved) => saved.id === marketId ? { ...saved, ...market, id: marketId } : saved) : [...current.markets, { ...market, id: marketId }], purchases: current.purchases.map((purchase) => purchase.id === modal.purchase.id ? { ...purchase, marketId, marketName: market.name, purchasedAt } : purchase.marketId === marketId ? { ...purchase, marketName: market.name } : purchase) })); setModal(null); setToast('Compra atualizada.') }} />}
    {modal?.type === 'share-list' && <ShareListModal list={state.lists[0]} onClose={() => setModal(null)} toast={setToast} />}
    {modal?.type === 'prompt' && <PromptModal onClose={() => setModal(null)} toast={setToast} />}
    <Toast message={toast} onClose={() => setToast('')} />
  </div>
}

function PageHeader({ eyebrow, title, text, action }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</div> }

const CATEGORY_ICONS = { Hortifruti: Apple, Mercearia: Coffee, Frios: Milk, Carnes: Beef, Bebidas: CupSoda, Limpeza: SprayCan, Higiene: Bath, Outros: Package }
function CategoryIcon({ category, size = 20 }) { const Icon = CATEGORY_ICONS[category] || Package; return <span className={`category-icon category-${categoryKey(category)}`}><Icon size={size}/></span> }

function ShoppingListPage({ state, mutate, open }) {
  const list = state.lists[0]
  const checked = list.items.filter((i) => i.checked).length
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('shopping-list-view') || 'list')
  const [groupByCategory, setGroupByCategory] = useState(() => localStorage.getItem('shopping-list-grouped') === 'true')
  const [itemMenu, setItemMenu] = useState(null)
  useEffect(() => localStorage.setItem('shopping-list-view', viewMode), [viewMode])
  useEffect(() => localStorage.setItem('shopping-list-grouped', String(groupByCategory)), [groupByCategory])
  useEffect(() => {
    if (!itemMenu) return undefined
    const close = () => setItemMenu(null)
    const closeOnEscape = (event) => { if (event.key === 'Escape') close() }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [itemMenu])
  const addProduct = (product) => mutate((s) => {
    const productKey = normalizeText(product.name)
    const existsInCatalog = s.products.some((saved) => normalizeText(saved.name) === productKey)
    return {
      ...s,
      products: existsInCatalog
        ? s.products.map((saved) => normalizeText(saved.name) === productKey ? { ...saved, archivedAt: null } : saved)
        : [...s.products, { ...product, archivedAt: null }],
      lists: s.lists.map((current) => ({ ...current, items: [...current.items, productToListItem(state, product)] })),
    }
  })
  const changeQuantity = (itemId, amount) => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, quantity: Math.max(0.1, Math.round((Number(amount) || 1) * 100) / 100) } : item) })) }))
  const toggleItem = (itemId) => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.map((saved) => saved.id === itemId ? { ...saved, checked: !saved.checked } : saved) })) }))
  const removeItem = (itemId) => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.filter((saved) => saved.id !== itemId) })) }))
  const renderItem = (item) => <ShoppingListItem key={item.id} item={item} viewMode={viewMode} onToggle={() => toggleItem(item.id)} onChangeQuantity={(amount) => changeQuantity(item.id, amount)} onOpenMenu={(position) => setItemMenu({ item, ...position })}/>
  const groups = CATEGORIES.map((category) => ({ category, items: list.items.filter((item) => category === 'Outros' ? !CATEGORIES.includes(item.category || 'Outros') || (item.category || 'Outros') === 'Outros' : item.category === category) }))
    .filter((group) => group.items.length)
  return <><PageHeader eyebrow="Planejamento" title="Lista de mercado"/>
    <InlineProductSearch products={state.products} list={list} state={state} onAdd={addProduct}/>
    <div className="toolbar shopping-list-toolbar"><span className="list-count">{list.items.length} {list.items.length === 1 ? 'item' : 'itens'}</span><div className="list-view-actions">{list.items.length > 0 && <button className="share-list-button" aria-label="Compartilhar lista" title="Compartilhar lista" onClick={() => open({ type: 'share-list' })}><Share2 size={16}/><span>Compartilhar</span></button>}<button className={`group-toggle ${groupByCategory ? 'active' : ''}`} aria-label="Agrupar por categoria" title="Agrupar por categoria" aria-pressed={groupByCategory} onClick={() => setGroupByCategory((current) => !current)}><Tags size={16}/><span>Agrupar por categoria</span></button><div className="view-toggle" aria-label="Modo de visualização"><button className={viewMode === 'list' ? 'active' : ''} title="Visualizar em lista" aria-label="Visualizar em lista" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={18}/></button><button className={viewMode === 'grid' ? 'active' : ''} title="Visualizar em grade" aria-label="Visualizar em grade" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={18}/></button></div>{checked > 0 && <button className="ghost remove-checked" aria-label={`Remover ${checked} ${checked === 1 ? 'item marcado' : 'itens marcados'}`} title="Remover itens marcados" onClick={() => mutate((s) => ({ ...s, lists: s.lists.map((current) => ({ ...current, items: current.items.filter((item) => !item.checked) })) }))}><Trash2 size={16}/><span>Remover marcados</span><b className="checked-count" aria-hidden="true">{checked}</b></button>}</div></div>
    {list.items.length ? (groupByCategory ? <div className="category-groups">{groups.map((group) => <section className={`category-group category-${categoryKey(group.category)}`} key={group.category}><header><CategoryIcon category={group.category} size={17}/><div><h2>{group.category}</h2><span>{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span></div></header><div className={`item-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>{group.items.map(renderItem)}</div></section>)}</div> : <div className={`item-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>{list.items.map(renderItem)}</div>) : <Empty icon={ShoppingBasket} title="Sua lista está vazia" text="Use a busca acima para adicionar o primeiro produto."/>}
    {itemMenu && <ItemContextMenu
      menu={itemMenu}
      onEdit={() => { open({ type: 'item', item: itemMenu.item }); setItemMenu(null) }}
      onRemove={() => { removeItem(itemMenu.item.id); setItemMenu(null) }}
    />}
  </>
}

function ShoppingListItem({ item, viewMode, onToggle, onChangeQuantity, onOpenMenu }) {
  const pressTimer = useRef(null)
  const pressStart = useRef(null)
  const longPressed = useRef(false)
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null }
  useEffect(() => clearPress, [])
  const startPress = (event) => {
    if (event.button !== 0 || event.target.closest('button,input')) return
    const element = event.currentTarget
    const pointer = { x: event.clientX, y: event.clientY }
    pressStart.current = pointer
    longPressed.current = false
    clearPress()
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      navigator.vibrate?.(18)
      onOpenMenu(menuPosition(element, pointer.x, pointer.y))
    }, 520)
  }
  const movePress = (event) => {
    if (!pressStart.current) return
    if (Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y) > 9) clearPress()
  }
  const finishPress = () => { clearPress(); pressStart.current = null }
  const clickCard = (event) => {
    if (event.target.closest('button,input')) return
    if (longPressed.current) { longPressed.current = false; event.preventDefault(); return }
    onToggle()
  }
  const openContextMenu = (event) => {
    event.preventDefault()
    clearPress()
    onOpenMenu(menuPosition(event.currentTarget, event.clientX, event.clientY))
  }
  const keyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); onToggle() }
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') { event.preventDefault(); onOpenMenu(menuPosition(event.currentTarget)) }
  }
  return <article className={`item-row simple category-${categoryKey(item.category)} ${item.checked ? 'checked' : ''}`} role="button" tabIndex="0" aria-pressed={item.checked} aria-label={`${item.name}. ${item.checked ? 'Comprado' : 'Pendente'}. Toque para ${item.checked ? 'desmarcar' : 'marcar'}; segure para mais opções.`} onClick={clickCard} onKeyDown={keyDown} onContextMenu={openContextMenu} onPointerDown={startPress} onPointerMove={movePress} onPointerUp={finishPress} onPointerCancel={finishPress}>
    {item.checked ? <span className="purchased-icon" aria-hidden="true"><Check size={20}/></span> : <CategoryIcon category={item.category}/>}<div className="item-main"><b>{item.name}</b>{viewMode === 'grid' && <small>{item.category}</small>}</div><div className="quantity-stepper"><button aria-label={`Diminuir quantidade de ${item.name}`} onClick={(event) => { event.stopPropagation(); onChangeQuantity(Number(item.quantity) - 1) }}>−</button><input aria-label={`Quantidade de ${item.name}`} type="number" min="0.1" step="1" value={item.quantity} onClick={(event) => event.stopPropagation()} onChange={(event) => onChangeQuantity(event.target.value)}/><span>{item.unit}</span><button aria-label={`Aumentar quantidade de ${item.name}`} onClick={(event) => { event.stopPropagation(); onChangeQuantity(Number(item.quantity) + 1) }}>+</button></div>
  </article>
}

function ItemContextMenu({ menu, onEdit, onRemove }) {
  return <div className="item-context-menu" role="menu" aria-label={`Opções de ${menu.item.name}`} style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
    <button role="menuitem" autoFocus onClick={onEdit}><Pencil size={17}/> Editar</button>
    <button role="menuitem" className="danger" onClick={onRemove}><Trash2 size={17}/> Remover</button>
  </div>
}

function menuPosition(element, pointerX, pointerY) {
  const rect = element.getBoundingClientRect()
  const width = 176
  const x = Math.min(Math.max(10, pointerX || rect.right - width), window.innerWidth - width - 10)
  const preferredY = pointerY || rect.bottom
  const y = preferredY + 104 > window.innerHeight ? Math.max(10, rect.top - 104) : preferredY
  return { x, y }
}

function PurchasesPage({ state, open }) { return <><PageHeader eyebrow="Histórico" title="Compras" text="Cada compra alimenta seu histórico de preços." action={<div className="button-pair"><button className="secondary" onClick={() => open({ type: 'import' })}><ReceiptText size={18}/> Importar JSON</button><button className="primary" onClick={() => open({ type: 'manual' })}><Plus size={18}/> Manual</button></div>}/>
  {state.purchases.length ? <div className="purchase-list">{state.purchases.map((purchase) => <button className="purchase-card" key={purchase.id} onClick={() => open({ type: 'purchase-detail', purchase })}><span className="card-icon"><Store/></span><span className="grow"><b>{purchase.marketName}</b><small>{shortDate(purchase.purchasedAt)} · {purchase.items.length} itens</small></span><strong>{money(purchase.total)}</strong><ChevronRight/></button>)}</div> : <Empty icon={ReceiptText} title="Nenhuma compra registrada" text="Importe o JSON de uma nota ou registre sua compra manualmente."/>}</> }

function PricesPage({ state }) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => priceRows(state).filter((row) => normalizeText(row.name).includes(normalizeText(query))), [state, query])
  return <><PageHeader eyebrow="Inteligência de preços" title="Compare antes de comprar" text="Valores são normalizados por kg, litro ou unidade quando possível."/><div className="search"><Search size={18}/><input placeholder="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)}/></div>
    {rows.length ? <div className="price-grid">{rows.map((row) => <article className={`price-card category-${categoryKey(row.category)}`} key={row.name}><div className="price-title"><CategoryIcon category={row.category}/><div><span>{row.category}</span><h3>{row.name}</h3><small>{row.count} registros · última compra {shortDate(row.latestDate)}</small></div></div><div className="metrics"><div><small>Último</small><b>{money(row.latest)}</b></div><div><small>Menor</small><b className="green">{money(row.min)}</b></div><div><small>Maior</small><b>{money(row.max)}</b></div></div>{row.unit && <p className="normalized">Melhor preço normalizado: {money(row.normalizedMin)} / {row.unit}</p>}<div className="market-tags">{row.markets.slice(0, 3).map((m) => <span key={m}>{m}</span>)}</div></article>)}</div> : <Empty icon={CircleDollarSign} title="Ainda não há preços para comparar" text="Registre uma compra para criar seu primeiro histórico."/>}
  </>
}

function ProductsPage({ state, mutate }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkPeriodicity, setBulkPeriodicity] = useState('30')
  const [productGrouping, setProductGrouping] = useState(() => {
    const saved = localStorage.getItem('products-grouping')
    return ['category', 'periodicity'].includes(saved) ? saved : localStorage.getItem('products-grouped') === 'true' ? 'category' : ''
  })
  useEffect(() => localStorage.setItem('products-grouping', productGrouping), [productGrouping])
  const products = state.products.filter((p) => !p.archivedAt && normalizeText(`${p.name} ${(p.brands || []).join(' ')}`).includes(normalizeText(query)))
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
    return <article className={`product-card category-${categoryKey(product.category)} ${selectedSet.has(product.id) ? 'selected' : ''}`} key={product.id}>
      <button className="product-select" aria-label={`Selecionar ${product.name}`} onClick={() => toggle(product.id)}>{selectedSet.has(product.id) && <Check size={15}/>}</button>
      <CategoryIcon category={product.category} size={22}/>
      <div className="grow"><b>{product.name}</b><small>{product.category} · {(product.variants || []).length} variações</small><label className="periodicity-control"><CalendarClock size={14}/><select aria-label={`Periodicidade de ${product.name}`} value={product.recurrenceDays == null ? 'auto' : String(product.recurrenceDays)} onChange={(event) => setProductPeriodicity([product.id], event.target.value)}>{PERIODICITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{product.recurrenceDays == null && <small className="automatic-hint">Sugestão atual: {frequency.label}</small>}<div className="market-tags">{(product.brands || []).filter(Boolean).map((brand) => <span key={brand}>{brand}</span>)}</div></div>
      <button className="icon-button archive-product" aria-label={`Arquivar ${product.name}`} title="Arquivar produto" onClick={() => archiveProduct(product.id)}><Archive size={17}/></button>
    </article>
  }
  return <>
    <PageHeader eyebrow="Catálogo aprendido" title="Produtos" text="A periodicidade automática usa seu histórico; você pode ajustar um item ou vários de uma vez."/>
    <div className="catalog-tools">
      <div className="search"><Search size={18}/><input placeholder="Produto ou marca" value={query} onChange={(e) => setQuery(e.target.value)}/></div>
      <div className="catalog-actions"><button className={`group-toggle ${productGrouping === 'category' ? 'active' : ''}`} aria-label="Agrupar produtos por categoria" title="Agrupar por categoria" aria-pressed={productGrouping === 'category'} onClick={() => setProductGrouping((current) => current === 'category' ? '' : 'category')}><Tags size={16}/><span>Agrupar por categoria</span></button><button className={`group-toggle ${productGrouping === 'periodicity' ? 'active' : ''}`} aria-label="Agrupar produtos por periodicidade" title="Agrupar por periodicidade" aria-pressed={productGrouping === 'periodicity'} onClick={() => setProductGrouping((current) => current === 'periodicity' ? '' : 'periodicity')}><CalendarClock size={16}/><span>Agrupar por periodicidade</span></button><button className="ghost select-visible" aria-label={allVisibleSelected ? 'Desmarcar produtos visíveis' : 'Selecionar produtos visíveis'} title={allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'} onClick={() => setSelected(allVisibleSelected ? selected.filter((id) => !products.some((product) => product.id === id)) : [...new Set([...selected, ...products.map((product) => product.id)])])}><Check size={16}/><span>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</span></button></div>
    </div>
    {selected.length > 0 && <div className="bulk-periodicity"><span><b>{selected.length}</b> selecionados</span><select aria-label="Periodicidade para os produtos selecionados" value={bulkPeriodicity} onChange={(event) => setBulkPeriodicity(event.target.value)}>{PERIODICITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="primary" onClick={() => { setProductPeriodicity(selected, bulkPeriodicity); setSelected([]) }}>Aplicar ao grupo</button></div>}
    {products.length ? (productGrouping ? <div className="category-groups product-category-groups">{groups.map((group) => <section className={`category-group ${group.category ? `category-${categoryKey(group.category)}` : 'periodicity-group'}`} key={group.key}><header>{group.category ? <CategoryIcon category={group.category} size={17}/> : <span className="category-icon periodicity-icon"><CalendarClock size={17}/></span>}<div><h2>{group.label}</h2><span>{group.products.length} {group.products.length === 1 ? 'produto' : 'produtos'}</span></div></header><div className="product-grid">{group.products.map(renderProduct)}</div></section>)}</div> : <div className="product-grid">{products.map(renderProduct)}</div>) : <Empty icon={PackageSearch} title="Nenhum produto visível" text="Produtos arquivados voltam automaticamente quando forem cadastrados ou importados novamente."/>}
  </>
}

function SettingsPage({ user, open, toast }) { return <><PageHeader eyebrow="Preferências" title="Ajustes" text="Conta, importação e estado da sincronização."/><div className="settings-list"><section className="settings-card"><span className="card-icon">{user ? <Cloud/> : <LogIn/>}</span><div className="grow"><b>{user ? user.displayName : 'Conta Google'}</b><small>{user ? user.email : firebaseReady ? 'Entre para sincronizar entre dispositivos' : 'Firebase ainda não configurado; seus dados estão seguros neste dispositivo'}</small></div>{user ? <button className="secondary" onClick={() => signOut(auth)}><LogOut size={16}/> Sair</button> : <button className="primary" disabled={!firebaseReady} onClick={() => loginWithGoogle().catch((e) => toast(e.message))}>Entrar</button>}</section><button className="settings-card clickable" onClick={() => open({ type: 'prompt' })}><span className="card-icon"><ClipboardCopy/></span><div className="grow"><b>Prompt para leitura da nota</b><small>Copie o formato esperado e use na IA de sua preferência</small></div><ChevronRight/></button><section className="settings-card"><span className="card-icon"><CloudOff/></span><div><b>PWA e modo offline</b><small>A lista permanece disponível sem conexão. A sincronização ocorre ao voltar.</small></div></section></div></> }

function InlineProductSearch({ products, list, state, onAdd }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const included = new Set(list.items.map((item) => normalizeText(item.name)))
  const normalizedQuery = normalizeText(query)
  const activeProducts = products.filter((product) => !product.archivedAt)
  const results = normalizedQuery
    ? activeProducts.filter((product) => normalizeText(`${product.name} ${product.category}`).includes(normalizedQuery)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10)
    : []
  const suggestionGroups = normalizedQuery ? [] : groupedProductSuggestions(state, list)
  const hasExactProduct = activeProducts.some((product) => normalizeText(product.name) === normalizedQuery)
  useEffect(() => {
    const closeOnOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])
  const add = (product) => {
    if (included.has(normalizeText(product.name))) return
    onAdd(product)
    setQuery('')
    setOpen(true)
  }
  const addGroup = (productsToAdd) => {
    productsToAdd.forEach(add)
    setQuery('')
  }
  return <div className="inline-autocomplete" ref={containerRef}>
    <div className={`autocomplete-search ${open ? 'open' : ''}`}><Search size={20}/><input role="combobox" aria-controls="product-options" aria-expanded={open} placeholder="Adicionar produto..." value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && results[0]) { event.preventDefault(); add(results[0]) } }}/><span className="search-hint">Digite para buscar</span></div>
    {open && <div className="autocomplete-popover"><div className="popover-heading"><b>{normalizedQuery ? 'Resultados' : 'Sugeridos para você'}</b><small>{normalizedQuery ? 'Buscando em todo o catálogo' : 'Organizados pela próxima compra'}</small></div><div className="autocomplete-results" id="product-options" role="listbox">
        {normalizedQuery ? results.map((product) => { const alreadyAdded = included.has(normalizeText(product.name)); return <SuggestionButton key={product.id} product={product} alreadyAdded={alreadyAdded} onAdd={add}/> }) : suggestionGroups.map((group) => <section className="suggestion-group" key={group.id}><header><div><b>{group.label}</b><small>{group.description}</small></div><button onClick={() => addGroup(group.products)}>Adicionar todos</button></header>{group.products.map((product) => <SuggestionButton key={product.id} product={product} onAdd={add} meta={product.suggestionMeta}/>)}</section>)}
        {query.trim() && !hasExactProduct && <button className="custom-product category-outros" onClick={() => add({ id: uid(), name: query.trim(), category: 'Outros', defaultUnit: 'un', brands: [], variants: [] })}><CategoryIcon category="Outros"/><span className="grow"><span className="new-title"><b>Criar “{query.trim()}”</b><em>Novo</em></span><small>Novo produto · unidade</small></span><Plus size={19}/></button>}
        {!results.length && !query.trim() && !suggestionGroups.length && <p className="autocomplete-empty">Registre uma compra para começarmos a prever quando os produtos vão faltar.</p>}
      </div></div>}
  </div>
}

function SuggestionButton({ product, alreadyAdded = false, onAdd, meta }) { return <button className={`category-${categoryKey(product.category)}`} role="option" aria-selected={alreadyAdded} disabled={alreadyAdded} onClick={() => onAdd(product)}><CategoryIcon category={product.category}/><span className="grow"><b>{product.name}</b><small>{meta || `${product.category} · ${product.defaultUnit || defaultUnitForProduct(product.name, product.category)}`}</small></span>{alreadyAdded ? <span className="added-label"><Check size={15}/> Na lista</span> : <Plus size={19}/>}</button> }

function ItemPanel({ item: initial, state, onClose, onSave }) {
  const [item, setItem] = useState(initial)
  const [updateCatalog, setUpdateCatalog] = useState(false)
  const history = purchaseHistoryFor(state, initial.name)
  const catalogProduct = state.products.find((product) => normalizeText(product.name) === normalizeText(initial.name))
  const catalogChanged = !catalogProduct || normalizeText(item.name) !== normalizeText(catalogProduct.name) || item.category !== catalogProduct.category || item.unit !== (catalogProduct.defaultUnit || defaultUnitForProduct(catalogProduct.name, catalogProduct.category))
  const submit = (event) => {
    event.preventDefault()
    if (!item.name.trim()) return
    onSave({ ...item, name: item.name.trim(), quantity: Math.max(0.1, Number(item.quantity) || 1) }, updateCatalog && catalogChanged)
  }
  return <Modal title="Editar item" subtitle="As alterações valem somente para esta lista, a menos que você escolha atualizar o catálogo." onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="item-edit-primary">
        <Field label="Produto"><input autoFocus required value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} placeholder="Ex.: Arroz"/></Field>
        <div className="form-grid"><Field label="Quantidade"><input type="number" min="0.1" step="0.1" value={item.quantity} onChange={(event) => setItem({ ...item, quantity: event.target.value })}/></Field><Field label="Unidade"><select value={item.unit} onChange={(event) => setItem({ ...item, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field></div>
      </div>

      <details className="item-edit-section">
        <summary><span><b>Mais detalhes</b><small>Categoria, marca e observação</small></span><ChevronRight size={18}/></summary>
        <div className="item-edit-section-body"><Field label="Categoria"><select value={item.category} onChange={(event) => setItem({ ...item, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Marca desejada (opcional)"><input value={item.brand || ''} onChange={(event) => setItem({ ...item, brand: event.target.value })} placeholder="Pode ser definida na compra"/></Field><Field label="Observação (opcional)"><input value={item.note || ''} onChange={(event) => setItem({ ...item, note: event.target.value })}/></Field></div>
      </details>

      {catalogChanged && <label className={`catalog-update-option ${updateCatalog ? 'selected' : ''}`}><input type="checkbox" checked={updateCatalog} onChange={(event) => setUpdateCatalog(event.target.checked)}/><span className="catalog-update-check">{updateCatalog && <Check size={15}/>}</span><span><b>Atualizar também no catálogo</b><small>Aplica nome, categoria e unidade padrão às sugestões e às futuras listas. Compras anteriores não serão alteradas.</small></span></label>}

      <details className="item-edit-section history-section">
        <summary><span><b>Histórico de compras</b><small>{history.length} {history.length === 1 ? 'registro' : 'registros'}</small></span><ChevronRight size={18}/></summary>
        <div className="item-edit-section-body">{history.length ? <div className="item-history">{history.map(({ purchase, item: bought }) => { const normalized = normalizedPrice(bought); return <article key={`${purchase.id}-${bought.id}`}><div><b>{shortDate(purchase.purchasedAt)} · {purchase.marketName}</b><small>{bought.brand || 'Sem marca informada'} · {bought.quantity} × {bought.packageSize} {bought.packageUnit}</small>{normalized && <em>{money(normalized.value)} / {normalized.unit}</em>}</div><strong>{money(bought.totalPrice)}</strong></article> })}</div> : <p className="collapsed-empty">Nenhuma compra anterior encontrada para {initial.name}.</p>}</div>
      </details>

      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary"><Check size={17}/> Salvar</button></div>
    </form>
  </Modal>
}

function ImportModal({ onClose, onReview }) { const [text, setText] = useState(''); const [error, setError] = useState(''); const readFile = (file) => file?.text().then(setText); return <Modal title="Importar nota em JSON" subtitle="Nada será salvo antes da sua revisão." onClose={onClose} wide><Field label="Cole o JSON gerado pela IA"><textarea className="json-input" value={text} onChange={(e) => { setText(e.target.value); setError('') }} placeholder='{ "mercado": ..., "itens": [...] }'/></Field><div className="file-row"><input type="file" accept="application/json,.json" onChange={(e) => readFile(e.target.files[0])}/></div>{error && <p className="error">{error}</p>}<div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!text.trim()} onClick={() => { try { onReview(normalizeImport(parseJsonInput(text))) } catch (e) { setError(e.message || 'JSON inválido.') } }}>Revisar importação</button></div></Modal> }

function ManualPurchaseModal({ markets, onClose, onReview }) { const [market, setMarket] = useState({ name: '', cnpj: '', legalName: '', address: '' }); const [date, setDate] = useState(dateTimeLocal()); const [items, setItems] = useState([]); const add = () => setItems([...items, { id: uid(), productName: '', brand: '', category: 'Outros', quantity: 1, packageSize: 1, packageUnit: 'un', unitPrice: 0, totalPrice: 0, originalDescription: '', barcode: '' }]); return <Modal title="Registrar compra manual" subtitle="Adicione os itens e revise antes de salvar." onClose={onClose} wide><div className="form-grid"><Field label="Mercado"><input value={market.name} onChange={(e) => setMarket({ ...market, name: e.target.value })} list="markets" placeholder="Nome do mercado"/><datalist id="markets">{markets.map((m) => <option key={m.id} value={m.name}/>)}</datalist></Field><Field label="Data"><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}/></Field></div><Field label="CNPJ (opcional)"><input value={market.cnpj} onChange={(e) => setMarket({ ...market, cnpj: e.target.value })}/></Field><EditableItems items={items} setItems={setItems}/><button className="secondary full" onClick={add}><Plus size={17}/> Adicionar item</button><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!market.name || !items.length} onClick={() => onReview({ market: { ...market, cnpj: onlyDigits(market.cnpj) }, purchasedAt: new Date(date).toISOString(), items })}>Revisar compra</button></div></Modal> }

function ReviewModal({ draft: initial, onClose, onSave }) { const [draft, setDraft] = useState(initial); const total = draft.items.reduce((s, i) => s + Number(i.totalPrice || 0), 0); return <Modal title="Revise a compra" subtitle="Confirme produtos, marcas, embalagens e valores." onClose={onClose} wide><div className="review-market"><Store/><div className="grow"><input className="title-input" value={draft.market.name} onChange={(e) => setDraft({ ...draft, market: { ...draft.market, name: e.target.value } })}/><small>{draft.market.cnpj ? `CNPJ ${draft.market.cnpj}` : 'CNPJ não informado'} · {shortDate(draft.purchasedAt)}</small></div><strong>{money(total)}</strong></div>{draft.purchaseDateInferred && <><p className="warning">A nota não informou uma data válida. Informe a data correta da compra.</p><Field label="Data da compra"><input type="datetime-local" value={dateTimeLocal(draft.purchasedAt)} onChange={(e) => setDraft({ ...draft, purchasedAt: new Date(e.target.value).toISOString(), purchaseDateInferred: false })}/></Field></>}{draft.declaredTotal > 0 && Math.abs(draft.declaredTotal - total) > 0.02 && <p className="warning">A soma dos itens ({money(total)}) difere do total declarado ({money(draft.declaredTotal)}).</p>}<EditableItems items={draft.items} setItems={(items) => setDraft({ ...draft, items })}/><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!draft.items.length} onClick={() => onSave(draft)}><Check size={17}/> Confirmar compra</button></div></Modal> }

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
  const [scope, setScope] = useState('missing')
  const text = shoppingListShareText(list.items, scope)
  const missing = list.items.filter((item) => !item.checked).length
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: scope === 'all' ? 'Lista de mercado' : 'O que falta comprar', text })
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
  return <Modal title="Compartilhar lista" subtitle="Escolha quais itens vão no texto." onClose={onClose}>
    <div className="share-scope" aria-label="Itens para compartilhar">
      <button className={scope === 'missing' ? 'active' : ''} aria-pressed={scope === 'missing'} onClick={() => setScope('missing')}>Só o que falta <span>{missing}</span></button>
      <button className={scope === 'all' ? 'active' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Lista completa <span>{list.items.length}</span></button>
    </div>
    <pre className="share-preview">{text}</pre>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={share}><Share2 size={17}/> Compartilhar</button></div>
  </Modal>
}

function EditableItems({ items, setItems }) { return <div className="editable-items">{items.map((item, index) => <div className="edit-item" key={item.id}><div className="edit-item-head"><b>Item {index + 1}</b><button className="icon-button danger" onClick={() => setItems(items.filter((i) => i.id !== item.id))}><Trash2 size={16}/></button></div>{item.originalDescription && <small className="original">Nota: {item.originalDescription}</small>}<div className="form-grid"><Field label="Produto"><input value={item.productName} onChange={(e) => updateItem(items, setItems, item.id, { productName: e.target.value })}/></Field><Field label="Marca"><input value={item.brand} onChange={(e) => updateItem(items, setItems, item.id, { brand: e.target.value })}/></Field><Field label="Qtd. comprada"><input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(items, setItems, item.id, { quantity: Number(e.target.value) })}/></Field><Field label="Tamanho embalagem"><div className="joined"><input type="number" step="0.001" value={item.packageSize} onChange={(e) => updateItem(items, setItems, item.id, { packageSize: Number(e.target.value) })}/><select value={item.packageUnit} onChange={(e) => updateItem(items, setItems, item.id, { packageUnit: e.target.value })}>{['un','kg','g','L','ml'].map((u) => <option key={u}>{u}</option>)}</select></div></Field><Field label="Preço unitário"><input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(items, setItems, item.id, { unitPrice: Number(e.target.value), totalPrice: Number(e.target.value) * Number(item.quantity) })}/></Field><Field label="Preço total"><input type="number" step="0.01" value={item.totalPrice} onChange={(e) => updateItem(items, setItems, item.id, { totalPrice: Number(e.target.value) })}/></Field></div></div>)}</div> }

function PurchaseDetail({ purchase, market, onClose, onEdit }) { return <Modal title={purchase.marketName} subtitle={`${shortDate(purchase.purchasedAt)} · ${purchase.items.length} itens${market?.cnpj ? ` · CNPJ ${market.cnpj}` : ''}`} onClose={onClose} wide><div className="receipt-total"><span>Total</span><strong>{money(purchase.total)}</strong></div><div className="receipt-items">{purchase.items.map((item) => { const normalized = normalizedPrice(item); return <div key={item.id}><div><b>{item.productName}</b><small>{item.brand || 'Sem marca'} · {item.quantity} × {item.packageSize} {item.packageUnit}</small>{normalized && <em>{money(normalized.value)} / {normalized.unit}</em>}</div><strong>{money(item.totalPrice)}</strong></div> })}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Fechar</button><button className="primary" onClick={onEdit}><Pencil size={17}/> Editar compra</button></div></Modal> }

function PromptModal({ onClose, toast }) { return <Modal title="Prompt para leitura da nota" subtitle="Anexe a foto da nota à IA e envie este texto." onClose={onClose} wide><pre className="prompt-box">{RECEIPT_PROMPT}</pre><div className="modal-actions"><button className="secondary" onClick={onClose}>Fechar</button><button className="primary" onClick={() => navigator.clipboard.writeText(RECEIPT_PROMPT).then(() => toast('Prompt copiado.'))}><ClipboardCopy size={17}/> Copiar prompt</button></div></Modal> }

function updateItem(items, setter, id, patch) { setter(items.map((item) => item.id === id ? { ...item, ...patch } : item)) }
function updateCatalogProduct(products, originalName, item) {
  const existing = products.find((product) => normalizeText(product.name) === normalizeText(originalName))
  if (!existing) return [...products, { id: uid(), name: item.name, category: item.category || 'Outros', defaultUnit: item.unit || 'un', brands: [item.brand].filter(Boolean), variants: [], archivedAt: null, createdAt: nowIso() }]
  return products.map((product) => product.id === existing.id ? { ...product, name: item.name, category: item.category || 'Outros', defaultUnit: item.unit || 'un', archivedAt: null } : product)
}
const CATEGORY_EMOJIS = { Hortifruti: '🥬', Mercearia: '🥫', Frios: '🧀', Carnes: '🥩', Bebidas: '🥤', Limpeza: '🧹', Higiene: '🧴', Outros: '📦' }
function shoppingListShareText(items, scope) {
  const selected = scope === 'missing' ? items.filter((item) => !item.checked) : items
  const title = scope === 'missing' ? '🛒 O que falta comprar' : '🛒 Lista de mercado'
  if (!selected.length) return `${title}\n\n✅ Tudo comprado!`
  const categories = [...CATEGORIES, ...new Set(selected.map((item) => item.category || 'Outros').filter((category) => !CATEGORIES.includes(category)))]
  const sections = categories.map((category) => {
    const categoryItems = selected.filter((item) => (item.category || 'Outros') === category)
    if (!categoryItems.length) return null
    const lines = categoryItems.map((item) => {
      const details = [`${item.quantity} ${item.unit}`, item.brand, item.note].filter(Boolean).join(' · ')
      return `${item.checked ? '✅' : '⬜'} ${item.name}${details ? ` — ${details}` : ''}`
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
function mergeProducts(products, items) { let result = [...products]; items.forEach((item) => { const key = normalizeText(item.productName); const existing = result.find((p) => normalizeText(p.name) === key); const variant = `${normalizeText(item.brand)}|${item.packageSize}|${item.packageUnit}`; if (existing) result = result.map((p) => p.id === existing.id ? { ...p, archivedAt: null, brands: [...new Set([...(p.brands || []), item.brand].filter(Boolean))], variants: [...new Set([...(p.variants || []), variant])], category: p.category === 'Outros' ? item.category : p.category, defaultUnit: p.defaultUnit || defaultUnitForProduct(item.productName, item.category) } : p); else result.push({ id: uid(), name: item.productName, category: item.category || 'Outros', defaultUnit: defaultUnitForProduct(item.productName, item.category), brands: [item.brand].filter(Boolean), variants: [variant], archivedAt: null, createdAt: nowIso() }) }); return result }
function latestPurchaseInfo(state, name) { for (const purchase of state.purchases) { const item = purchase.items.find((i) => normalizeText(i.productName) === normalizeText(name)); if (item) return { item, purchase } } return null }
function purchasesForProduct(state, name) { return state.purchases.filter((purchase) => purchase.items.some((item) => normalizeText(item.productName) === normalizeText(name))).sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)) }
function categoryDefaultDays(category) { return ({ Hortifruti: 7, Frios: 7, Carnes: 14, Mercearia: 30, Bebidas: 30, Limpeza: 60, Higiene: 60, Outros: 30 })[category] || 30 }
function nearestPeriod(days) { return [7, 14, 30, 60, 90].reduce((best, value) => Math.abs(value - days) < Math.abs(best - days) ? value : best, 30) }
function periodicityLabel(days) { return PERIODICITY_OPTIONS.find((option) => Number(option.value) === days)?.label || `A cada ${days} dias` }
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
function productToListItem(state, product) { const last = latestPurchaseInfo(state, product.name)?.item; return { id: uid(), name: product.name, quantity: 1, unit: product.defaultUnit || defaultUnitForProduct(product.name, product.category), category: product.category || 'Outros', brand: last?.brand || '', note: '', checked: false } }
function purchaseHistoryFor(state, name) { return state.purchases.flatMap((purchase) => purchase.items.filter((item) => normalizeText(item.productName) === normalizeText(name)).map((item) => ({ purchase, item }))).sort((a, b) => new Date(b.purchase.purchasedAt) - new Date(a.purchase.purchasedAt)) }
function categoryKey(category = 'Outros') { return normalizeText(category).replace(/\s+/g, '-') }
function priceRows(state) { const groups = new Map(); state.purchases.forEach((purchase) => purchase.items.forEach((item) => { const key = normalizeText(item.productName); const norm = normalizedPrice(item); const value = norm?.value || Number(item.totalPrice) / (Number(item.quantity) || 1); const current = groups.get(key) || { name: item.productName, category: item.category || 'Outros', entries: [] }; current.entries.push({ value, raw: Number(item.totalPrice), unit: norm?.unit, date: purchase.purchasedAt, market: purchase.marketName }); groups.set(key, current) })); return [...groups.values()].map((group) => { const sorted = [...group.entries].sort((a,b) => new Date(b.date)-new Date(a.date)); const comparable = group.entries.filter((e) => e.unit && e.unit === group.entries.find((x) => x.unit)?.unit); return { name: group.name, category: group.category, count: group.entries.length, latest: sorted[0].raw, latestDate: sorted[0].date, min: Math.min(...group.entries.map((e) => e.raw)), max: Math.max(...group.entries.map((e) => e.raw)), normalizedMin: comparable.length ? Math.min(...comparable.map((e) => e.value)) : null, unit: comparable[0]?.unit, markets: [...new Set(group.entries.map((e) => e.market))] } }).sort((a,b) => a.name.localeCompare(b.name)) }
