import React from "react";
import "./HomeScreen.css";
import Header from "../atoms/Header";
import PieCharts from "../atoms/PieCharts";
import ListItem from "../atoms/ListItem";
import IIBarChart from "../atoms/IIBarChart";
import ChipList from "../atoms/ChipList";
import LastestIssues from "../atoms/LastestIssues";
import RecentSearches from "../atoms/RecentSearches";
import AgencyIntel from "../atoms/AgencyIntel";
import DashboardListItem from "../atoms/DashboardListItem";
import Prisons from "../atoms/Prisons";

function HomeScreen() {
  return (
    <div className="home">
      {/* header */}
      <div className="header">
        <Header />
      </div>
      {/* actions */}
      <div className="user-actions">
        {/* <h1 className="overview-heading">Everything In One Place</h1> */}
      </div>
      <div className="main-content">
        {/* sect-one */}
        <div className="sect-one">
          <PieCharts />
          <div style={{ marginTop: "5px" }}>
            <ListItem />
          </div>
          <div className="filler"></div>
        </div>
        {/* sect-two */}
        <div className="sect-one">
          <ChipList />
          <IIBarChart />
        </div>
        <div className="filler">
        <DashboardListItem/>
        </div>
        {/* sect-three */}
        <div className="sect-one">
          <LastestIssues />
          <AgencyIntel />
          <RecentSearches />
          <AgencyIntel />
        </div>
        <div className="filler">
        <Prisons/>
        <Prisons/>

        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
