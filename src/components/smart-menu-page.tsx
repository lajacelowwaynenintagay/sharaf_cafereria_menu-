"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ITEM_DESCRIPTIONS } from "@/lib/item-descriptions";

import {
  BRAND_NAME,
  CURRENCY_LIST,
  LANG_ORDER,
  STORAGE_KEYS,
  UI_COPY,
  fetchMenuData,
  fetchMenuStatus,
  filterMenuItems,
  formatMoney,
  getCategoryTitle,
  getDishImageUrl,
  getDisplayGreeting,
  getHeroImageUrl,
  getHeroVideoUrl,
  getLocalizedText,
  getLogoUrl,
} from "@/lib/smart-menu";
import type {
  CartItem,
  MenuData,
  MenuItem,
  MenuLanguage,
  MenuStatusEntry,
  MenuStatusMap,
} from "@/types/menu";

type LayoutMode = "list" | "gallery";
type ThemeMode = "dark" | "light";
type FilterMode = "all" | "veg" | "drinks" | "fast-food";
type RenderEntry =
  | { kind: "group"; label: string; key: string }
  | { kind: "item"; item: MenuItem; index: number; status: MenuStatusEntry };

function safeStorageGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function loadCart(): CartItem[] {
  const raw = safeStorageGet(STORAGE_KEYS.cart);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  safeStorageSet(STORAGE_KEYS.cart, JSON.stringify(cart));
}

function normalizeTable(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]/g, "");
}

function DishImage({ item, alt }: { item: MenuItem; alt: string }) {
  const [src, setSrc] = useState(getDishImageUrl(item));

  useEffect(() => {
    setSrc(getDishImageUrl(item));
  }, [item]);

  return (
    <img
      src={src}
      alt={alt}
      className="dish-thumb"
      loading="lazy"
      onError={() => setSrc("/images/placeholder-dish.svg")}
    />
  );
}

export function SmartMenuPage() {
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<MenuLanguage>("en");
  const [currency, setCurrency] = useState("ETB");
  const [layout, setLayout] = useState<LayoutMode>("gallery");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chefOpen, setChefOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [cartTableNumber, setCartTableNumber] = useState("");
  const [liveStatus, setLiveStatus] = useState<MenuStatusMap>({});
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [slideAnim, setSlideAnim] = useState("reveal");

  useEffect(() => {
    let cancelled = false;

    fetchMenuData()
      .then((data) => {
        if (cancelled) return;

        setMenuData(data);
        setLang((safeStorageGet(STORAGE_KEYS.lang) as MenuLanguage | null) ?? data.settings.default_language);
        setCurrency(safeStorageGet(STORAGE_KEYS.currency) ?? data.settings.currency);
        
        let savedCat = null;
        if (typeof window !== "undefined") {
          savedCat = window.sessionStorage.getItem("active_category");
        }
        if (savedCat && data.categories.some(c => c.id === savedCat)) {
          setCurrentCategory(savedCat);
        } else {
          setCurrentCategory(data.categories[0]?.id ?? null);
        }

        const storedTheme = safeStorageGet(STORAGE_KEYS.theme) as ThemeMode | null;
        if (!storedTheme) {
          setTheme("light");
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load menu.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLang = safeStorageGet(STORAGE_KEYS.lang) as MenuLanguage | null;
      const storedCurrency = safeStorageGet(STORAGE_KEYS.currency);
      const storedLayout = safeStorageGet(STORAGE_KEYS.layout) as LayoutMode | null;
      const storedTheme = safeStorageGet(STORAGE_KEYS.theme) as ThemeMode | null;

      if (storedLang && LANG_ORDER.includes(storedLang)) setLang(storedLang);
      if (storedCurrency && CURRENCY_LIST.includes(storedCurrency)) setCurrency(storedCurrency);
      if (storedLayout === "list" || storedLayout === "gallery") setLayout(storedLayout);
      else setLayout("gallery");
      // Always default to light mode on refresh
      setTheme("light");
      setCart(loadCart());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchMenuStatus()
      .then((value) => {
        setLiveStatus(value);
      })
      .catch(() => {
        setLiveStatus({});
      });
  }, []);

  useEffect(() => {
    if (!currentCategory) return;
    const btn = document.getElementById(`cat-btn-${currentCategory}`);
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentCategory]);

  // Re-sync cart from localStorage whenever window regains focus (e.g. returning from item detail).
  // The component stays mounted during SPA navigation so the initial mount effect doesn't re-run.
  useEffect(() => {
    const syncCart = () => setCart(loadCart());
    window.addEventListener("focus", syncCart);
    // Also handle the visibilitychange event for mobile browsers
    const onVisible = () => { if (document.visibilityState === "visible") syncCart(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", syncCart);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Restore home scroll position when returning from an item page
  useEffect(() => {
    if (typeof window === "undefined" || !menuData) return;
    const saved = sessionStorage.getItem("home_scroll");
    if (saved) {
      sessionStorage.removeItem("home_scroll");
      // Use setTimeout to ensure DOM is fully updated after menuData state change
      setTimeout(() => {
        const scrollContainer = document.getElementById("main-scroll");
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: parseInt(saved, 10), behavior: "instant" });
        }
      }, 50);
    }
  }, [menuData]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeStorageSet(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    safeStorageSet(STORAGE_KEYS.lang, lang);
  }, [lang]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.currency, currency);
  }, [currency]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.layout, layout);
  }, [layout]);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => setToastVisible(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

  const copy = UI_COPY[lang];

  const filteredItems = useMemo(() => {
    if (!menuData) return [];
    return filterMenuItems({
      items: menuData.items,
      categoryId: currentCategory,
      searchText,
      filter,
      lang,
    });
  }, [currentCategory, filter, lang, menuData, searchText]);

  const renderEntries = useMemo<RenderEntry[]>(() => {
    const showSubgroups = searchText.trim().length === 0;
    let subgroupCursor = "";
    let itemIndex = 0;
    const entries: RenderEntry[] = [];

    for (const item of filteredItems) {
      const status = liveStatus[item.id] ?? {};
      const stock = status.stock ?? "available";
      if (stock === "out") continue;

      if (showSubgroups && item.subgroup && item.subgroup !== subgroupCursor) {
        subgroupCursor = item.subgroup;
        entries.push({
          kind: "group",
          label: item.subgroup,
          key: `${item.category}-${item.subgroup}`,
        });
      }

      entries.push({
        kind: "item",
        item,
        index: itemIndex,
        status,
      });
      itemIndex += 1;
    }

    return entries;
  }, [filteredItems, liveStatus, searchText]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );

  const currentCategoryTitle = useMemo(() => {
    if (!menuData) return "...";
    return searchText
      ? copy.search
      : getCategoryTitle(menuData.categories, currentCategory, lang);
  }, [copy.search, currentCategory, lang, menuData, searchText]);

  const closePopups = () => {
    setChefOpen(false);
    setCartOpen(false);
  };

  const changeCategory = (id: string) => {
    if (!menuData) return;
    const currentIdx = menuData.categories.findIndex(c => c.id === currentCategory);
    const newIdx = menuData.categories.findIndex(c => c.id === id);
    if (newIdx > currentIdx) setSlideAnim("slide-left");
    else if (newIdx < currentIdx) setSlideAnim("slide-right");
    else setSlideAnim("reveal");
    
    setSearchText("");
    setCurrentCategory(id);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("active_category", id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !menuData) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const diffX = touchStart.x - endX;
    const diffY = Math.abs(touchStart.y - endY);

    if (diffY > Math.abs(diffX) + 20) {
       setTouchStart(null);
       return;
    }
    
    const SWIPE_THRESHOLD = 50;
    const categories = menuData.categories;
    const currentIndex = categories.findIndex(c => c.id === currentCategory);

    if (diffX > SWIPE_THRESHOLD && currentIndex < categories.length - 1) {
      changeCategory(categories[currentIndex + 1].id);
    } else if (diffX < -SWIPE_THRESHOLD && currentIndex > 0) {
      changeCategory(categories[currentIndex - 1].id);
    }
    setTouchStart(null);
  };

  const cycleLanguage = () => {
    const index = LANG_ORDER.indexOf(lang);
    setLang(LANG_ORDER[(index + 1) % LANG_ORDER.length]);
  };

  const cycleCurrency = () => {
    const index = CURRENCY_LIST.indexOf(currency);
    setCurrency(CURRENCY_LIST[(index + 1) % CURRENCY_LIST.length] ?? "$");
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const removeFromCart = (index: number) => {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const submitWaiterCall = () => {
    const normalized = normalizeTable(tableNumber);
    if (!normalized || normalized.length > 5) {
      window.alert("Please enter a valid Table No. (max 5 letters/numbers).");
      return;
    }

    setTableNumber("");
    closePopups();
    showToast(copy.waiterToast);
  };

  const submitOrder = () => {
    if (cart.length === 0) {
      window.alert(copy.cartEmpty);
      return;
    }

    const normalized = normalizeTable(cartTableNumber);
    if (!normalized || normalized.length > 5) {
      window.alert(copy.tablePrompt);
      return;
    }

    setCart([]);
    setCartTableNumber("");
    closePopups();
    showToast(copy.orderToast);
  };

  const getResolvedPrice = (item: MenuItem, status?: MenuStatusEntry) =>
    status?.price ?? item.price;

  const renderSpecialBadge = (badge: string) => {
    const badgeColor = badge === "COLD" ? "#06b6d4" : "#D4AF37";
    const icon = badge === "COLD" ? "fa-snowflake" : "fa-star";

    return (
      <span
        key={badge}
        className="admin-badge"
        style={{ background: "#ffffff12", color: badgeColor }}
      >
        <i className={`fas ${icon}`} /> {badge}
      </span>
    );
  };

  const renderSpice = (badge: string) => {
    const counts: Record<string, number> = { SPICY: 1, SPICY1: 1, SPICY2: 2, SPICY3: 3 };
    const count = counts[badge] ?? 1;

    return (
      <span className="spice-wrapper" key={badge}>
        <i className="fas fa-fire fire-gradient" />
        {Array.from({ length: count }).map((_, index) => (
          <span className="chilli-icon" key={`${badge}-${index}`}>
            🌶️
          </span>
        ))}
      </span>
    );
  };

  return (
    <main className="smart-menu-page">
      <nav className="nav">
        <div className="brand">
          <img src={getLogoUrl()} alt={BRAND_NAME} />
        </div>
        <div className="nav-actions">
          <button type="button" className="nav-btn" onClick={cycleCurrency} id="curr-btn">
            {currency}
          </button>
          <button type="button" className="nav-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <i className={`fas ${theme === "dark" ? "fa-moon" : "fa-sun"}`} id="themeIcon" />
          </button>
{/* Language option removed as requested */}
          <button type="button" className="nav-btn" id="cart-btn" onClick={() => setCartOpen(true)}>
            <i className="fas fa-shopping-bag" />
            <div id="cartBadge" className={`cart-badge ${cartCount ? "" : "hidden"}`}>
              {cartCount}
            </div>
          </button>
        </div>
      </nav>

      <div id="main-scroll">
        <div className="hero reveal">
          <img src={getHeroImageUrl()} alt="" className="hero-bg-image" aria-hidden="true" />
          <video id="hero-video" className="hero-bg-video" autoPlay muted playsInline loop key={theme}>
            <source id="video-source" src={getHeroVideoUrl(theme)} type="video/mp4" />
          </video>
          <span className="greet-badge premium-text" id="greet-text">
            {getDisplayGreeting(lang)}
          </span>
          <h1 className="hero-title premium-text" id="hero-title">
            {menuData?.settings.restaurant_name ?? BRAND_NAME}
          </h1>
          <div className={`alert-wrapper ${menuData ? "show" : ""}`} id="alert-wrapper">
            <div id="kitchen-alert" className="smart-status gold">
              <i className="fas fa-bell" /> <span id="ui-kitchen">{copy.kitchen}</span>
            </div>
          </div>
        </div>

        <div className="section-header reveal" style={{ animationDelay: "0.1s" }}>
          <span className="section-title" id="ui-sec-cat">{copy.cats}</span>
          <span className="scroll-hint">
            <span id="ui-swipe">{copy.swipe}</span> <i className="fas fa-arrows-left-right" />
          </span>
        </div>

        <div className="cat-scroller" id="cat-list">
          {menuData?.categories.map((category) => {
            const categoryName = getLocalizedText(category.name, lang);
            const active = category.id === currentCategory && !searchText;
            const scrollable = categoryName.length > 10;

            return (
              <button
                type="button"
                key={category.id}
                id={`cat-btn-${category.id}`}
                className={`cat-card ${active ? "active" : ""}`}
                onClick={() => changeCategory(category.id)}
              >
                <i className={`fas ${category.icon} cat-icon`} />
                <div className="cat-name-wrapper">
                  <div className={`cat-name ${active && scrollable ? "scrollable" : ""}`}>{categoryName}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={`items-header reveal ${layout === "gallery" ? "gallery-mode" : ""}`}
          style={{ animationDelay: "0.2s" }}
          id="sticky-header"
        >
          <div className="search-container">
            <i className="fas fa-search search-icon-fixed" />
            <input
              type="text"
              className="search-input"
              placeholder={copy.search}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              id="searchBox"
            />
          </div>

          <div className="header-controls-row">
            <div className="current-cat-title" id="cat-title">{currentCategoryTitle}</div>
            <div className="controls-group">
{/* Filter row removed per user request */}

              <div className="layout-switch">
                <button type="button" className={`switch-opt ${layout === "list" ? "active" : ""}`} id="sw-list" onClick={() => setLayout("list")}>
                  <i className="fas fa-list" />
                </button>
                <button type="button" className={`switch-opt ${layout === "gallery" ? "active" : ""}`} id="sw-gallery" onClick={() => setLayout("gallery")}>
                  <i className="fas fa-th-large" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div 
          className={`items-container ${slideAnim} ${layout === "gallery" ? "gallery-mode" : ""}`} 
          id="item-list"
          key={`${currentCategory}-${slideAnim}-${layout}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {!menuData && !error ? (
            <>
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </>
          ) : null}
          {error ? <div className="empty-state">{error}</div> : null}
          {menuData && renderEntries.length === 0 ? <div className="empty-state">{copy.noItems}</div> : null}

          {renderEntries.map((entry) => {
            if (entry.kind === "group") {
              return (
                <div className="subgroup-heading" key={entry.key}>
                  <span>{entry.label}</span>
                </div>
              );
            }

            const { item, index, status } = entry;
            const title = getLocalizedText(item.title, lang);
            const stock = status.stock ?? "available";

            const calories = item.calories
              ? `${String(item.calories).toLowerCase().replace(/k?cal(ories)?/g, "").trim()} Calories`
              : null;
            const resolvedPrice = getResolvedPrice(item, status);
            const hasOffer = typeof status.offer === "number" && status.offer > 0;
            const offeredPrice = hasOffer
              ? resolvedPrice - resolvedPrice * ((status.offer ?? 0) / 100)
              : resolvedPrice;
            const displayPrice = formatMoney(resolvedPrice, currency);
            const dietIcon = item.type === "veg" ? "fa-leaf" : "fa-drumstick-bite";
            const dietColor = item.type === "veg" ? "#4ade80" : "#ef4444";
            const badges = status.badges ?? [];
            const specialBadges = badges.filter((badge) =>
              ["NEW", "SPECIAL", "COLD"].includes(badge),
            );
            const heatBadges = badges.filter((badge) =>
              ["HOT", "SPICY", "SPICY1", "SPICY2", "SPICY3"].includes(badge),
            );
            const cardClass = [
              "item-card",
              "reveal",
              item.is_4d ? "is-4d" : "",
              stock === "few" ? "few" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Link
                href={`/appview?cat=${encodeURIComponent(item.category)}&id=${encodeURIComponent(item.id)}`}
                key={`${item.id}-${index}`}
                className={cardClass}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const scrollContainer = document.getElementById("main-scroll");
                    if (scrollContainer) {
                      sessionStorage.setItem("home_scroll", String(scrollContainer.scrollTop));
                    }
                  }
                }}
              >
                <div className="thumb-wrapper">
                  <DishImage item={item} alt={title} />
                  {badges.includes("NEW") ? <div className="new-badge-absolute">NEW</div> : null}
                  {stock === "few" ? null : null}
                </div>

                <div className="dish-info">
                  <div className="badge-wrapper">
                    {specialBadges
                      .filter((badge) => badge !== "NEW")
                      .map((badge) => renderSpecialBadge(badge))}
                  </div>
                  <div className="dish-name">{title}</div>
                  {(() => {
                    const desc = item.description
                      ? getLocalizedText(item.description, lang)
                      : ITEM_DESCRIPTIONS[item.id];
                    return desc ? (
                      <div className="dish-desc" style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "4px 0 2px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.45" }}>
                        {desc}
                      </div>
                    ) : null;
                  })()}
                  <div className="dish-cal">
                    {calories}
                    {" "}
                    <i className={`fas ${dietIcon}`} style={{ color: dietColor }} />
                  </div>
                  <div className="ingredient-row">
                    {heatBadges.map((badge) => renderSpice(badge))}
                    {stock === "few" ? (
                      <span className="stock-warn">
                        <i className="fas fa-exclamation-circle" /> Few Left!
                      </span>
                    ) : null}
                  </div>
                  {/* Ingredients are only shown in the detailed item view now */}
                  <div className="dish-price">
                    {hasOffer ? (
                      <>
                        <span className="old-price">{formatMoney(resolvedPrice, currency)}</span>
                        {formatMoney(offeredPrice, currency)}
                      </>
                    ) : (
                      displayPrice
                    )}
                  </div>
                </div>

                <div className="diet-badge" aria-hidden="true">
                  <i className={`fas ${dietIcon}`} style={{ color: dietColor }} />
                </div>

                {item.is_4d ? (
                  <div className="badge-4d">
                    <i className="fas fa-cube" /> 4D
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      <button type="button" className="chef-call" onClick={() => setChefOpen(true)}>
        <i className="fas fa-user-tie" />
      </button>

      <button
        type="button"
        className={`overlay ${chefOpen || cartOpen ? "active" : ""}`}
        id="overlay"
        onClick={closePopups}
        aria-label="Close popup"
      />

      <div className={`popup ${chefOpen ? "active" : ""}`} id="chefPopup">
        <i className="fas fa-bell-concierge popup-icon" />
        <h2 className="popup-heading" id="ui-chef-title">{copy.waiterTitle}</h2>
        <p className="popup-copy" id="ui-chef-desc">{copy.waiterDesc}</p>
        <input
          type="text"
          id="chefTableInput"
          className="table-input"
          placeholder={copy.waiterInput}
          value={tableNumber}
          onChange={(event) => setTableNumber(event.target.value)}
        />
        <button className="btn-action gold-button" onClick={submitWaiterCall} id="ui-chef-btn">
          {copy.waiterButton}
        </button>
      </div>

      <div className={`panel ${cartOpen ? "open" : ""}`} id="cartPanel">
        <h3 className="panel-title">
          <i className="fas fa-shopping-bag" /> <span id="ui-cart-title">{copy.cartTitle}</span>
        </h3>
        <div id="cartList" className="cart-list">
          {cart.length === 0 ? (
            <div className="empty-cart">{copy.cartEmpty}</div>
          ) : (
            cart.map((item, index) => (
              <div className="cart-item" key={`${item.id}-${index}`}>
                <span className="cart-item-name">{item.qty}x {item.title}</span>
                <div className="cart-item-details">
                  <span>{formatMoney(item.price * item.qty, currency)}</span>
                  <button type="button" className="cart-item-remove" onClick={() => removeFromCart(index)} aria-label="Remove cart item">
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <input
          type="text"
          id="cartTableInput"
          className="table-input"
          placeholder={copy.tablePrompt}
          value={cartTableNumber}
          onChange={(event) => setCartTableNumber(event.target.value)}
        />
        <div className="total-row">
          <span className="total-label-group">
            <span id="ui-cart-total-lbl">{copy.cartTotal}</span>
            <span className="tax-note" id="ui-cart-tax-lbl">{copy.cartTax}</span>
          </span>
          <span className="total-val" id="cartTotalVal">{formatMoney(cartTotal, currency)}</span>
        </div>
        <button className="btn-action gold-button" onClick={submitOrder} id="ui-cart-btn">
          {copy.cartButton}
        </button>
      </div>

      <div id="toast" className={toastVisible ? "show" : ""}>{toastMessage}</div>
    </main>
  );
}
