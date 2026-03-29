import React from 'react'

interface HeaderProps {
  title: string
  pageUrl: string
  pageTitle: string
  onClear: () => void
}

export function Header({ title, pageUrl, onClear }: HeaderProps) {
  const displayUrl = pageUrl
    ? pageUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 35)
    : 'No page'

  return (
    <div className="sidebar-header">
      <div className="sidebar-header__brand">
        <div className="sidebar-header__logo">B</div>
        <div>
          <div className="sidebar-header__title">{title}</div>
          <div className="sidebar-header__url" title={pageUrl}>
            {displayUrl}
          </div>
        </div>
      </div>
      <div className="sidebar-header__actions">
        <button
          className="icon-btn"
          onClick={onClear}
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 1h5a1 1 0 0 1 1 1v1H4V2a1 1 0 0 1 1-1zM2 4h11l-.9 9H2.9L2 4zm4 2v5m3-5v5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
