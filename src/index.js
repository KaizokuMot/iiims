import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import "mdb-react-ui-kit/dist/css/mdb.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import DocumentAnalysis from "./screens/DocumentAnalysis";
import { SocialMediaProvider } from "./context/SocialMediaContext";

import {
  BrowserRouter as Router,
  Route,
  Routes,
  Outlet,
  useLocation,
} from "react-router-dom";
import HomeScreen from "./components/HomeDashboard/HomeDashboard";
import Login from "./screens/Login";
import Data_ from "./screens/HomeScreen"
import SideBar from "./atoms/DashboardMain";
import AIChat from "./screens/AIChat";
import Data from "./TestDataPoint/Intel";
import AddIntel from "./screens/AddIntel";
import FacialRecognition from "./screens/FacialRecognition";
import Intelholder from "./atoms/Intelholder";
import NeuralNet from "./operations/NeuralNet";
import ML from "./screens/ML";
import AWSFaces from "./atoms/AWSFaces";
import WebCrawler from "./screens/WebCrawler";
import SocialMedia from "./screens/SocialMedia";
import AudioRecorder from "./screens/AudioRecorder";
import TestSocialMedia from "./screens/TestSocialMedia";
import BackgroundCheck from "./screens/BackgroundCheck";
import AgentCenter from "./screens/AgentCenter";
import IntelNexus from "./screens/IntelNexus";

const AppLayout = () => {
  const location = useLocation();
  const hideSideBarOnRoute = ["/"];
  const isHidden = hideSideBarOnRoute.includes(location.pathname);

  return (
    <div className="lay">
      {!isHidden && (
        <div className="sidebar">
          <SideBar />
        </div>
      )}
      <div className="outta">
        <Outlet />
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <SocialMediaProvider>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<HomeScreen />} />
            <Route path="/chat" element={<AIChat data={Data} />} />
            {/* <Route path="/add-intel" element={<AddIntel />} /> */}
            <Route path="/face-recog" element={<FacialRecognition />} />
            <Route path="/view-all" element={<Intelholder />} />
            <Route path="/iiims-net" element={<ML />} />
            <Route path="/data-entry" element={<Data_ />} />
            <Route path="/report-analysis" element={<DocumentAnalysis />} />
            <Route path="/web-crawler" element={<SocialMedia />} />
            <Route path="/audio-recorder" element={<AudioRecorder />} />
            <Route path="/background-check" element={<BackgroundCheck />} />
            <Route path="/intel-nexus" element={<IntelNexus />} />
            <Route path="/agent-center" element={<AgentCenter />} />
            <Route path="/test-social" element={<TestSocialMedia />} />
          </Route>
        </Routes>
      </Router>
    </SocialMediaProvider>
  </React.StrictMode>
);

reportWebVitals();
