import React from "react";
import RootNavigation from "./src/navigation/rootNavigation";
import { Provider } from "react-redux";
import { store } from "./src/redux/store";
import { ThemeProvider } from "./src/theme/ThemeContext";
import "./src/i18n";

const App = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <RootNavigation />
      </ThemeProvider>
    </Provider>
  );
};

export default App
