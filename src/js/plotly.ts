// Bind react-plotly.js to the cartesian-only Plotly dist (the dependency
// declared in package.json). The default `react-plotly.js` entry pulls in the
// full `plotly.js/dist/plotly` bundle; using the factory with the cartesian
// dist keeps the bundle smaller while still supporting our scatter traces.
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-cartesian-dist-min";

const Plot = createPlotlyComponent(Plotly);

export default Plot;
