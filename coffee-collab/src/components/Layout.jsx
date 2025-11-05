// Layout component with sidebar
import { Sidebar } from './Sidebar'

export function Layout({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main
          style={{
            marginLeft: '64px',
            flex: 1,
            padding: '24px',
            paddingBottom: '80px',
            background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #D2691E 50%, #DEB887 75%, #F5DEB3 100%)',
            minHeight: '100vh'
          }}
        >
          {children}
        </main>
      </div>
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: '64px',
          right: 0,
          background: 'rgba(139, 69, 19, 0.95)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 100
        }}
      >
        <div style={{ color: '#FFF', fontSize: '14px' }}>
          <strong>☕ meuCaféGrão</strong> - Controle Automático de Fornecimento, Estoque e Gerenciamento de Registro de Abastecimento Operacional
        </div>
        <div style={{ color: '#FFF', fontSize: '12px', opacity: 0.8 }}>
          Feito com ❤️ e muito ☕ | {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}

