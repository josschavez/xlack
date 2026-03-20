import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../features/auth/stores/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../features/auth/components/LoginView.vue'),
    },
    {
      path: '/app',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      redirect: '/app',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.user) {
    return '/login'
  }
  if (to.path === '/login' && auth.user) {
    return '/app'
  }
})

export default router
