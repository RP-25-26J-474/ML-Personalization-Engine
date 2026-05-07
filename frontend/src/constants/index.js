export const navSections = [
  {
    label: "Platform",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        subtitle: "Overview of the ML Personalization Engine",
      },
      {
        to: "/temporary-user-detector",
        label: "Temporary User Detector",
        subtitle: "Manage temporary user detection settings",
      },
      {
        to: "/category-engine",
        label: "Category Engine",
        subtitle: "Configure category-based recommendations",
      },
      {
        to: "/user-engine",
        label: "User Engine",
        subtitle: "Manage user-based recommendations",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/train", label: "Train Models", subtitle: "Train personalization models" },
      { to: "/admin/users", label: "Monitor Users", subtitle: "Browse users and inspect MLPE profile data" },
      // { to: "/pipelines", label: "Pipelines", subtitle: "Manage data pipelines" },
      // { to: "/monitoring", label: "Monitoring", subtitle: "Monitor system performance" },
      // { to: "/settings", label: "Settings", subtitle: "Configure system settings" },
    ],
  },
];

export const TemporaryUserDetectorDefaultPayload = {
  batches: [
    {
      user_id: "u_001",
      batch_id: "b_keep",
      captured_at: "2025-10-06T11:25:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 2,
        misclick_rate: 0.02,
        avg_click_interval_ms: 540,
        avg_dwell_ms: 90,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 75,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_quarantine",
      captured_at: "2025-10-06T11:27:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 3,
        misclick_rate: 0.07,
        avg_click_interval_ms: 788,
        avg_dwell_ms: 61,
        rage_clicks: 14,
        zoom_events: 0,
        scroll_speed_px_s: 152,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_reject",
      captured_at: "2025-10-06T11:29:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 5,
        misclick_rate: 0.6,
        avg_click_interval_ms: 80,
        avg_dwell_ms: 180,
        rage_clicks: 8,
        zoom_events: 0,
        scroll_speed_px_s: 880,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_keep_2",
      captured_at: "2025-10-06T11:31:00Z",
      page_context: {
        domain: "example.com",
        route: "/home",
        app_type: "web",
      },
      events_agg: {
        click_count: 2,
        misclick_rate: 0.04,
        avg_click_interval_ms: 470,
        avg_dwell_ms: 80,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 60,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_quarantine_2",
      captured_at: "2025-10-06T11:33:00Z",
      page_context: {
        domain: "example.com",
        route: "/search",
        app_type: "web",
      },
      events_agg: {
        click_count: 8,
        misclick_rate: 0.02,
        avg_click_interval_ms: 845,
        avg_dwell_ms: 81,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 252,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_reject_2",
      captured_at: "2025-10-06T11:35:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 6,
        misclick_rate: 0.72,
        avg_click_interval_ms: 90,
        avg_dwell_ms: 200,
        rage_clicks: 7,
        zoom_events: 1,
        scroll_speed_px_s: 920,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_keep_3",
      captured_at: "2025-10-06T11:37:00Z",
      page_context: {
        domain: "example.com",
        route: "/account",
        app_type: "web",
      },
      events_agg: {
        click_count: 2,
        misclick_rate: 0.01,
        avg_click_interval_ms: 315,
        avg_dwell_ms: 85,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 140,
      },
    },
  ],
};

export const CategoryEngineDefaultPayload = {
  user_id: "u_001",
  session_id: "onb_001",
  captured_at: "2025-10-06T11:00:00Z",
  impairment_probs: {
    vision: {
      vision_loss: 0.2,
      color_blindness: 0.1,
    },
    motor: {
      delayed_reaction: 0.3,
      inaccurate_click: 0.2,
      motor_impairment: 0.34,
    },
    literacy: 0.4,
  },
  onboarding_metrics: {
    avg_reaction_ms: 720,
    hit_rate: 0.88,
  },
  device_context: {
    os: "Windows",
    browser: "Chrome",
    screen_w: 1440,
    screen_h: 900,
    dpr: 1,
  },
};

export const UserEngineDefaultPayload = {
  user_id: "u_001",
  batch_id: "b_001",
  captured_at: "2025-10-06T11:25:00Z",
  page_context: {
    domain: "example.com",
    route: "/checkout",
    app_type: "web",
  },
  events_agg: {
    click_count: 24,
    misclick_rate: 0.12,
    avg_click_interval_ms: 430,
    avg_dwell_ms: 2100,
    rage_clicks: 1,
    zoom_events: 2,
    scroll_speed_px_s: 260,
  },
};

export const UserEngineBatchDefaultPayload = {
  batches: [
    {
      user_id: "u_001",
      batch_id: "b_keep_1",
      captured_at: "2025-10-06T11:25:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 2,
        misclick_rate: 0.02,
        avg_click_interval_ms: 540,
        avg_dwell_ms: 90,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 75,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_keep_2",
      captured_at: "2025-10-06T11:27:00Z",
      page_context: {
        domain: "example.com",
        route: "/home",
        app_type: "web",
      },
      events_agg: {
        click_count: 2,
        misclick_rate: 0.04,
        avg_click_interval_ms: 470,
        avg_dwell_ms: 80,
        rage_clicks: 0,
        zoom_events: 0,
        scroll_speed_px_s: 60,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_quarantine",
      captured_at: "2025-10-06T11:29:00Z",
      page_context: {
        domain: "example.com",
        route: "/search",
        app_type: "web",
      },
      events_agg: {
        click_count: 3,
        misclick_rate: 0.07,
        avg_click_interval_ms: 788,
        avg_dwell_ms: 61,
        rage_clicks: 14,
        zoom_events: 0,
        scroll_speed_px_s: 152,
      },
    },
  ],
};
