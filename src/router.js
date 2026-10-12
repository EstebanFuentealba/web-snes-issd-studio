import { createRouter, createWebHashHistory } from 'vue-router';
import Home from './views/Home.vue';
import { studioRoutes } from './navigation.mjs';

const About = { template: '<div>About</div>' };

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    ...studioRoutes(Home),
    { path: '/about', name: 'About', component: About },
  ],
  linkActiveClass: 'active',
});
