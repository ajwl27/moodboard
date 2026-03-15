import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomeView } from './views/HomeView/HomeView';
import { BoardView } from './views/BoardView/BoardView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/board/:id" element={<BoardView />} />
      </Routes>
    </BrowserRouter>
  );
}
