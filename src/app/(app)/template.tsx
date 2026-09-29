// Her sayfa geçişinde yeniden oluşturulur: yeni sayfa hafifçe süzülerek belirir.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
